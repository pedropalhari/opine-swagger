import {
  opine,
  json,
  serveStatic,
} from "https://deno.land/x/opine@1.1.0/mod.ts";

import { initDocer } from "https://raw.githubusercontent.com/pedropalhari/opine-swagger/master/mod.ts";
import { initExample } from "./routes/Example.ts";

const app = opine();
app.use(json());

let routes = [{ init: initExample, prefix: "/example" }];

routes.forEach((r) => app.use(r.prefix, r.init()));

app.listen(3000);

await initDocer(app, {
  info: {
    title: "Example API",
    description: "This is an API created for demonstration purposes",
    version: "0.1",
  },
});

console.log("Listening on http://localhost:3000");

export {};
