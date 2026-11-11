import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReadQuery } from "../client/src/lib/use-read-query";

const queryKey = ["engineering-read-state-regression"];
function ReadView() {
  const result = useReadQuery<{ value: number }>({ queryKey });
  return React.createElement("p", null, result.isError ? "read failed"
    : result.isLoading ? "read loading" : result.data ? `ready:${result.data.value}` : "read absent");
}
function render(client: QueryClient) {
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(ReadView)));
}

test("SSR ready cache survives optimistic observer fetching without inventing a pending read", () => {
  const client = new QueryClient();
  client.setQueryData(queryKey, { value: 0 });
  assert.equal(client.getQueryState(queryKey)?.fetchStatus, "idle");
  assert.match(render(client), /ready:0/);
  client.clear();
});

test("actual pending read with cached data is withheld, then the new ready result renders", async () => {
  const client = new QueryClient();
  client.setQueryData(queryKey, { value: 123 });
  let complete!: (value: { value: number }) => void;
  const gate = new Promise<{ value: number }>(resolve => { complete = resolve; });
  const pending = client.fetchQuery({ queryKey, queryFn: () => gate });
  assert.equal(client.getQueryState(queryKey)?.fetchStatus, "fetching");
  assert.match(render(client), /read loading/);
  assert.doesNotMatch(render(client), /123/);
  complete({ value: 0 });
  await pending;
  assert.match(render(client), /ready:0/);
  client.clear();
});

test("failed current read does not expose retained successful data", async () => {
  const client = new QueryClient();
  client.setQueryData(queryKey, { value: 123 });
  await assert.rejects(client.fetchQuery({
    queryKey, retry: false, queryFn: async () => { throw new Error("engineering read failure"); },
  }), /engineering read failure/);
  assert.match(render(client), /read failed/);
  assert.doesNotMatch(render(client), /123/);
  client.clear();
});
