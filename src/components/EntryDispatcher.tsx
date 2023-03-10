import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSearchContext } from "../contexts/SearchContextProvider";
import { loadingDisable, loadingEnable } from "../helpers/loadingEffects";
import swapiEntry from "../helpers/swapiEntry";
import swapiSearch from "../helpers/swapiSearch";
import wooParseArticleImage from "../helpers/wooParseArticleImage";
import wooSearchArticle from "../helpers/wooSearchArticle";
import { SwapiCats, SwapiTypes } from "../models";
import dataToShow from "./EntryDispatcherData";
import EntryFactory from "./EntryFactory";

const urlToPrettyInternalLink = async (url: string): Promise<JSX.Element> => {
  const uri = String(url).replace(/^https?:.*?api\//, "/");
  const [cat, id] = uri.replace(/^\/(.*)\/$/, "$1").split("/");
  const data = await swapiEntry(cat, id);

  // Handle the generic Homeworld 'unknown', see: /species/6/; /planets/28/
  if (data["name"] === "unknown") data["name"] = data["name"].toUpperCase();

  return <Link to={uri}>{data["name"] ?? data["title"]}</Link>;
};

interface Props {}

const EntryDispatcher: React.FC<Props> = (props) => {
  const {
    setSearched,
    searchResults,
    setSearchResults,
    setIsNewSession,
    selSrchEntry,
    setSelSrchEntry,
    beMeticulous,
    showWooData,
    setSearchCategory
  } = useSearchContext();
  // let dataToShowManipulated: OutputData = JSON.parse(JSON.stringify(dataToShow));
  const [entry, setEntry] = useState<SwapiTypes>({} as SwapiTypes);
  const navigate = useNavigate();
  const location = useLocation();

  const cats: string[] = [];
  for (const key in SwapiCats) cats.push(key);

  const { cat, id } = useParams<string>();

  useEffect(() => {
    sessionStorage.setItem("SS_LOADING", "true");
    loadingEnable();

    try {
      (async () => {
        // Get the Entry data
        const newEntry = await swapiEntry(cat!, id!);

        if (!newEntry) navigate("/search");
        console.log(newEntry);

        // Get the data (name) of the related 'items' (entries)
        // within the Entry and convert them to a Links.
        const secondApiReq: string[] = ["homeworld", "films"];

        if (beMeticulous) {
          // Get the list of the false keys from dataToShow{}
          for (const category in dataToShow) {
            for (const key in dataToShow[category]) {
              if (key === "category") continue;
              if (!dataToShow[category][key] && !secondApiReq.includes(key))
                secondApiReq.push(key);
            }
          }
        }

        for (const item of secondApiReq) {
          if (newEntry[item]) {
            if (Array.isArray(newEntry[item])) {
              const newItems: JSX.Element[] = [];

              for (const fetchItem of newEntry[item]) {
                if (typeof fetchItem === "string") {
                  const getPrettyLink = await urlToPrettyInternalLink(fetchItem);
                  newItems.push(getPrettyLink);
                }
              }

              if (newItems.length) {
                newEntry[item] = newItems;
              } else {
                newEntry[item] = "N/a";
              }
            } else if (typeof newEntry[item] === "string") {
              newEntry[item] = await urlToPrettyInternalLink(newEntry[item]);
            }
          } else if (newEntry.hasOwnProperty(item)) {
            newEntry[item] = String(newEntry[item]) ?? "N/a";
          }
        }

        const entryId = `${newEntry.category}-${(newEntry.title ?? newEntry.name)
          .replace(/ /g, "-")
          .toLowerCase()}`;
        if (selSrchEntry !== entryId) setSelSrchEntry(entryId);

        /**
         * Wookieepedia integration API calls
         */
        if (showWooData) {
          const article = await wooSearchArticle(newEntry.title ?? newEntry.name);
          const image = await wooParseArticleImage(article);
          newEntry.woo = { article, image };
        }

        setEntry(newEntry);
      })();
    } catch (error) {
      console.log(error);
      navigate("/search");
    }
  }, [location, beMeticulous, showWooData]);

  useEffect(() => {
    if (!cats.includes(cat!)) {
      setSelSrchEntry("");
      setIsNewSession(true);
      setSearched("");
      setSearchResults([]);
      navigate("/search");
    }

    /**
     * When it is direct hit to a Entry,
     * without search  - i.e. /people/59/
     */
    if (!searchResults.length) {
      try {
        (async () => {
          /**
           * This loads just the first page
          const results = await swapiSearch([cat!], "[show all]");
           */
          /**
           * The siple calculation of the page doesn't works because there 
           * possibly have gaps in the lists - i.e. removed IDs,
           * like at the first page of the Vehicles:
           * [9]:vehicles/20/ [10]:vehicles/24/
           const catPaginationPage = String(Math.ceil(parseInt(id!) / 10));
           const newCatState = await swapiSearch([cat!], catPaginationPage, "page");
           */

          /**
           * So we need to scan the category page by page,
           * which is the slowest method I can image,
           * but, IMO, nothing other is possible
           * with the current API capabilities!?!

           */
          const catPaginationPage = String(Math.ceil(parseInt(id!) / 10));
          const regExp = new RegExp(`^.*\/${cat}\/${id}\/$`);
          let newCatState: any[] = [];

          for (let i: number = 1; i <= 10000; i++) {
            const newCatCurrent = await swapiSearch([cat!], String(i), "page");
            if (newCatCurrent[0].results.find((item) => item.url.match(regExp))) {
              newCatState = newCatCurrent;
              break;
            }
          }

          setSearchCategory(cat!);
          setSearchResults(newCatState);
        })();
      } catch (error) {
        console.log(error);
        navigate("/search");
      }
    }
  }, []);

  const getDataArray = (): string[] => {
    const dataShowArray: string[] = [];
    const currentCategoryData = { ...dataToShow[entry?.category] };

    for (const key in currentCategoryData) {
      if (key === "category") continue;

      if (beMeticulous) {
        dataShowArray.push(key);
      } else {
        if (currentCategoryData[key]) dataShowArray.push(key);
      }
    }

    sessionStorage.setItem("SS_LOADING", "false");
    setTimeout(() => {
      loadingDisable();
    }, 800);
    return dataShowArray;
  };

  return <EntryFactory data={entry} fields={getDataArray()} />;
};

export default EntryDispatcher;
