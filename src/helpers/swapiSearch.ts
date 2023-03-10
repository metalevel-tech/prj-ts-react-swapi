import DOMPurify from "dompurify";
import { SwapiSearchResult } from "../models";
import swapiAxiosClient from "./swapiAxiosClient";

// Actions:  "search" | "page"
// Searched: "string" | "number of page"
const swapiSearch =
  async (categories: string[], searched: string, action: string = "search"): Promise<SwapiSearchResult[]> => {
    const searchDataArray: SwapiSearchResult[] = [];
    let uri: (cat: string) => string;

    // Handle the special value that will query the category(s) for all items
    // Otherwise build the URI for the user's request.
    if (searched === "[show all]") {
      uri = (cat: string): string => `${cat}/`;
    } else {
      const word: string = DOMPurify.sanitize(searched).replace(/["?]/g, "");
      uri = (cat: string): string => `${cat}/?${action}=${word}`;
    }

    for (const category of categories) {
      try {
        // Get only the data property from the response
        const { data } = await swapiAxiosClient.get(uri(category));

        if (category === "films")
          data.results.sort((a: any, b: any) => a.episode_id - b.episode_id);

        searchDataArray.push({ ...data, category });
      } catch (error) {
        console.error(error);
      }
    }

    return searchDataArray
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count);
  };

export default swapiSearch;
