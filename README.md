# Opine Swagger

## This module is _highly_ underdeveloped. Ugly types, almost no functionality, I recommend you do _not_ use it, but contribute to it as you want.

Well, you got past that warning, so how does this work?

Basically inject `swagger` capabilities into `opine` doing some ugly, ugly code for now. It downloads Swagger on the first run!

Let's see a basic example:

```ts
//server.ts
import { json, opine } from "https://deno.land/x/opine@1.1.0/mod.ts";
import { initDocer } from "../mod.ts";
import { initExample } from "./routes/Example.ts";

const app = opine();
app.use(json());

let routes = [{ init: initExample, prefix: "/example" }];

routes.forEach((r) => app.use(r.prefix, r.init()));

app.listen(3000);

// Must be called after everything
await initDocer(app, {
  info: {
    title: "Example API",
    description: "This is an API created for demonstration purposes",
    version: "0.1",
  },
});

console.log("Listening on http://localhost:3000");

export {};
```

```ts
import { opine } from "https://deno.land/x/opine@1.1.0/src/opine.ts";
import { docerApp, J } from "../../mod.ts";

type ExampleType = J.TypeOf<typeof Example>;
const Example = J.type({
  age: J.string,
});

const ExamplePostBodySchema = J.type({
  name: J.string,
  id: J.string,
  user: Example,
});

const ExampleGetParamsSchema = J.type({
  exampleId: J.string,
});

export function initExample() {
  const app = opine();
  const router = docerApp(app, "/example");

  router.postDoc<{ Body: typeof ExamplePostBodySchema }>(
    "/post_route",
    {
      body: { schema: ExamplePostBodySchema, description: "Some description" },
    },
    (req, res) => {
      let { id, name } = req.body;

      return res.send({
        id,
        name2: name,
      });
    }
  );

  router.getDoc<{ Params: typeof ExampleGetParamsSchema }>(
    "/get_route/:exampleId",
    {
      params: { schema: ExampleGetParamsSchema },
    },
    (req, res) => {
      let { exampleId } = req.params;

      return res.send({
        id: exampleId,
      });
    }
  );

  return router;
}
```
