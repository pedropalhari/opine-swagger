import { opine } from "https://deno.land/x/opine@1.1.0/src/opine.ts";
import { docerApp } from "../../mod.ts";
import * as J from "https://deno.land/x/jsonschema/jsonschema.ts";

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
