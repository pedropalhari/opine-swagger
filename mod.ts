import * as J from "https://deno.land/x/jsonschema/jsonschema.ts";
import {
  Opine,
  request,
  Response,
  serveStatic,
} from "https://deno.land/x/opine@1.1.0/mod.ts";
import { MultiProgressBar } from "https://deno.land/x/progress@v1.2.3/mod.ts";

const bars = new MultiProgressBar({
  title: "Swagger Download",
  // clear: true,
  complete: "=",
  incomplete: "-",
  display: "[:bar] :text :percent :time :completed/:total bytes",
});

/**
 * Generic to be passed to the methods, so we can
 * define separately the options for each property
 * on the request
 */
interface HandlerOptions {
  Body?: any;
  Params?: any;
  QueryString?: any;
}

/**
 * The handler function, typed horribly for now as Opine
 * doesn't let me extend `body`
 */
type Handler<T extends HandlerOptions> = (
  req: {
    body: J.TypeOf<T["Body"]>;
    query: J.TypeOf<T["QueryString"]>;
    params: J.TypeOf<T["Params"]>;
  },
  res: Response<any>
) => void;

/**
 * An extension of the handler function that normally
 * comes with express, this allows us to generate the JSON
 * schema for Swagger properly, using the path and options
 */
type HandlerFunctionWithDocumentation = <T extends HandlerOptions>(
  path: string,
  options: Options,
  handlers: Handler<T>
) => any;

/**
 * The DocerApp is a minimally-viable wrapper around
 * the normal Opine instance. It exposes only documented routes
 */
interface DocerApp extends Opine {
  getDoc: HandlerFunctionWithDocumentation;
  postDoc: HandlerFunctionWithDocumentation;
  putDoc: HandlerFunctionWithDocumentation;
  patchDoc: HandlerFunctionWithDocumentation;
  deleteDoc: HandlerFunctionWithDocumentation;
}

/**
 * Properties for methods
 */
interface MethodOptionPropery {
  schema: J.JsonSchema<any>;
  description?: string;
}

/**
 * All the options for a method
 */
interface Options {
  body?: MethodOptionPropery;
  params?: MethodOptionPropery;
  querystring?: MethodOptionPropery;
}

type RouteMethods = "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
/**
 * This function generates a function that, when invoked, generates documentation
 * for the method.
 * @param routeMethod
 * @param app
 * @param prefix
 */
function createRouteWithDocumentation(
  routeMethod: RouteMethods,
  app: Opine,
  prefix?: string
): HandlerFunctionWithDocumentation {
  let method = routeMethod.toLowerCase();

  return (path, options, handlers) => {
    let ROUTE_PATH = `${prefix || ""}${path}`;

    // Parse parameters, make /route/:param1/:param2 => /route/{param1}/{param2}
    ROUTE_PATH = ROUTE_PATH.split("/")
      .map((param) =>
        param.includes(":") ? `{${param.replace(":", "")}}` : param
      )
      .join("/");

    // Create </path>: { <METHOD> : { parameters: [] }}
    if (!BASE_DOC.paths[ROUTE_PATH]) BASE_DOC.paths[ROUTE_PATH] = {};
    if (!BASE_DOC.paths[ROUTE_PATH][method])
      BASE_DOC.paths[ROUTE_PATH][method] = {};
    if (!BASE_DOC.paths[ROUTE_PATH][method]["parameters"])
      BASE_DOC.paths[ROUTE_PATH][method]["parameters"] = [];

    if (options.body) {
      let { schema, description } = options.body;
      BASE_DOC.paths[ROUTE_PATH][method]["parameters"].push({
        in: "body",
        name: "body",
        description,
        schema: J.print(schema),
      });
    }

    if (options.params) {
      let { schema, description } = options.params;
      Object.keys((J.print(schema) as any).properties).forEach((key) => {
        BASE_DOC.paths[ROUTE_PATH][method]["parameters"].push({
          in: "path",
          name: key,
        });
      });
    }

    if (options.querystring) {
      let { schema, description } = options.querystring;
      BASE_DOC.paths[ROUTE_PATH][method]["parameters"].push({
        in: "query",
        name: "query parameters",
        description,
        schema: J.print(schema),
      });
    }

    BASE_DOC.paths[ROUTE_PATH][method]["responses"] = {
      200: {},
    };

    (app as any)[method](path, handlers as any);
  };
}

/**
 * Returns an Opine instance with documentation capabilities on methods.
 *
 * Calling `<method>Doc(...)` will generate JSON Schema that's readable by swagger on
 * that specific method.
 *
 * @param app
 * @param prefix
 */
export function docerApp(app: Opine, prefix?: string): DocerApp {
  let docerApp = app as DocerApp;

  docerApp.getDoc = createRouteWithDocumentation("GET", app, prefix);
  docerApp.postDoc = createRouteWithDocumentation("POST", app, prefix);
  docerApp.putDoc = createRouteWithDocumentation("PUT", app, prefix);
  docerApp.patchDoc = createRouteWithDocumentation("PATCH", app, prefix);
  docerApp.deleteDoc = createRouteWithDocumentation("DELETE", app, prefix);

  return docerApp;
}

interface InitOptions {
  info?: { title?: string; version?: string; description?: string };
  schemes?: string[];
}

/**
 * Function that downloads swagger to test
 */
async function downloadSwagger() {
  let swaggerFolderExists = false;
  try {
    // If it doesn't exists, it throws
    await Deno.stat("./swagger");
    swaggerFolderExists = true;
  } catch (err) {}

  let docsFolderExists = false;
  try {
    await Deno.stat("./swagger/docs");
    docsFolderExists = true;
  } catch (err) {}

  let swaggerExists = false;
  try {
    await Deno.stat("./swagger/docs/swagger-ui.js");
    swaggerExists = true;
  } catch (err) {}

  if (!swaggerFolderExists) await Deno.mkdir("./swagger");

  if (!docsFolderExists) await Deno.mkdir("./swagger/docs");

  if (!swaggerExists) {
    console.log("Installing swagger, this only happens once!");

    let response = await fetch(
      `https://codeload.github.com/swagger-api/swagger-ui/zip/v3.42.0`
    );

    const reader = response.body?.getReader();

    if (!reader) return;

    // Step 2: get total length
    const contentLength = response.headers.get("Content-Length");

    // Step 3: read the data
    let receivedLength = 0; // received that many bytes at the moment
    let chunks = []; // array of received binary chunks (comprises the body)
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) return;

      chunks.push(value);
      receivedLength += value.length;

      bars.render([
        {
          completed: receivedLength,
          total: parseInt(contentLength!),
          text: "swagger-v3.42.0.zip",
        },
      ]);
    }

    // Step 4: concatenate chunks into single Uint8Array
    let chunksAll = new Uint8Array(receivedLength); // (4.1)
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position); // (4.2)
      position += chunk.length;
    }

    await Deno.writeFile("./swagger-temp.zip", new Uint8Array(chunksAll));

    console.log("\n\n");

    let process = await Deno.run({
      cmd: ["unzip", "./swagger-temp.zip", "-d", "./swagger-temp"],
    });

    await process.status();
    process.close();

    await Deno.rename(
      "./swagger-temp/swagger-ui-3.42.0/dist",
      "./swagger/docs"
    );

    console.log("\n\n Removing temporary files");

    await Deno.remove("./swagger-temp.zip");
    await Deno.remove("./swagger-temp", { recursive: true });

    let swaggerIndex = await Deno.readTextFile("./swagger/docs/index.html");
    swaggerIndex = swaggerIndex.replace(
      '"https://petstore.swagger.io/v2/swagger.json"',
      "`${window.location.origin}/docs/docs.json`"
    );
    await Deno.writeTextFileSync("./swagger/docs/index.html", swaggerIndex);
  }
}

/**
 * This initializes the library, it **must** come after every <method>Doc(...) function
 * is called
 * @param options
 */
export async function initDocer(app: Opine, options?: InitOptions) {
  await downloadSwagger();

  app.use(serveStatic("swagger"));

  let swaggerJsonDoc = { ...BASE_DOC, ...options };
  await Deno.writeTextFile(
    "./swagger/docs/docs.json",
    JSON.stringify(swaggerJsonDoc)
  );
}

/**
 * This object is modified on each <method>Doc calling, and then it's written
 * by the end on `initDocer` calling
 */
let BASE_DOC: any = {
  swagger: "2.0",
  info: {
    description: "Swagger description",
    version: "1.0.0",
    title: "Swagger documentation",
  },

  tags: [],
  paths: {},
  definitions: {},
};

export { J };
