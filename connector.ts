import { Connector, Media } from "@chili-publish/studio-connectors";

function toDictionary(
  obj: Record<string, any>
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = '';
    } else if (typeof value === 'boolean') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.join(',');
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else if (
      typeof value === 'symbol' ||
      typeof value === 'bigint' ||
      typeof value === 'function'
    ) {
      result[key] = value.toString();
    } else {
      result[key] = String(value);
    }
  }

  return result;
}
export default class MyConnector implements Media.MediaConnector {

  private runtime: Connector.ConnectorRuntimeContext;

  constructor(runtime: Connector.ConnectorRuntimeContext) {
    this.runtime = runtime;
  }

  async query(
    options: Connector.QueryOptions,
    context: Connector.Dictionary
  ): Promise<Media.MediaPage> {
    // initialize DB on local server
    //  - this step is only needed for this POC, typically this would already be done in whatever service you're getting CSV details from
    const initSheetDB = await this.runtime.fetch(`${this.runtime.options["baseURL"]}/initDB`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sheetEndpoint: context["sheetURL"] })
    });
    if (initSheetDB.ok) {
      // Main connector code goes here
      // Query before download check (metadata gets mapped here)
      if (options.pageSize === 1 && !options.collection) {
        return await this.handleQueryBeforeDownload(options, context);
      }

      // Searches entire sheet
      //  - For this use case, this probably won't ever get used, just here for completeness sake
      return await this.handleSearch(options, context);
    }
  }

  // Not using this for actual iamges, so not needed
  detail(
    id: string,
    context: Connector.Dictionary
  ): Promise<Media.MediaDetail> {
    throw new Error("Method not implemented.");
  }

  async download(
    id: string,
    previewType: Media.DownloadType,
    intent: Media.DownloadIntent,
    context: Connector.Dictionary
  ): Promise<Connector.ArrayBufferPointer> {
    // This will always return the same dummy image, just so there's something in the variable that it expects

    // CAN CHANGE THIS URL TO ANYTHING THAT RETURNS AN IMAGE
    const url = `${this.runtime.options["baseURL"]}/resources/dummyimg`;
    
    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });
    return resp.arrayBuffer;
  }

  getConfigurationOptions(): Connector.ConnectorConfigValue[] | null {
    return [
      {
        name: "searchOn",
        displayName: "Search On:",
        type: "text"
      },
      {
        name: "sheetURL",
        displayName: "CSV Download URL:",
        type: "text"
      }
    ];
  }

  getCapabilities(): Media.MediaConnectorCapabilities {
    return {
      query: true,
      detail: false,
      filtering: true,
      metadata: true,
    };
  }

  async handleQueryBeforeDownload(
    options: Connector.QueryOptions,
    context: Connector.Dictionary
  ): Promise<Media.MediaPage> {
    const id = options.filter[0] ?? '';
    let url = `${this.runtime.options["baseURL"]}/search/${context["searchOn"]}/${id}`;

    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });

    if (resp.ok) {
      const data = JSON.parse(resp.text);

      return {
        pageSize: options.pageSize ?? 1,
        data: [{
          id: id as string,
          name: id as string,
          relativePath: "",
          type: 0,
          metaData: {
            ...toDictionary(data)
          }
        }],
        links: {
          nextPage: ''
        }
      }
    }
  }

  async handleSearch(
    options: Connector.QueryOptions,
    context: Connector.Dictionary
  ): Promise<Media.MediaPage> {
    let url = `${this.runtime.options["baseURL"]}/search/all`;

    const resp = await this.runtime.fetch(url, {
      method: "GET"
    });
    
    if(resp.ok) {
      const data = JSON.parse(resp.text);
      const dataFormatted = data.map(d => ({
        id: d[(context["searchOn"]) as string],
        name: d[(context["searchOn"]) as string],
        relativePath: '/',
        type: 0,
        metaData: {}
      })) as Array<any>;
      
      return {
        pageSize: options.pageSize ?? 1,
        data: dataFormatted,
        links: {
          nextPage: ""
        }
      }
    } else {
      throw new ConnectorHttpError(resp.status, "connector failed :(");
    }
  }
}