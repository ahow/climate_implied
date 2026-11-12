import type { RequestHandler } from "express";
import { bindNestedOutput } from "../shared/outputFieldSemantics";
import { nativeScenarios, type NativeScenario } from "../shared/nativeConsumer";
import { bindProducerIdentity } from "./producerDownload";
import { captureNativeInputs, replayNativeCandidate, retainNativeCandidate, type NativeCandidateStore } from "./snapshots/nativeCandidateProducer";

/** The same real candidate producer used by production registration and HTTP
 * tests. Optional store replaces storage only, never engine/source inputs. */
export function nativeCandidateHandler(store?: NativeCandidateStore): RequestHandler {
  return async (req, res) => {
    const scenario = req.query.scenario ?? "constant";
    if (typeof scenario !== "string" || !Object.hasOwn(nativeScenarios, scenario))
      return void res.status(400).json({ error: "scenario must be constant, transition or dashboard" });
    try {
      const input = captureNativeInputs();
      const response = replayNativeCandidate(input, scenario as NativeScenario);
      const fields = bindNestedOutput("native", response);
      res.set("X-Field-Semantics-Family", "native");
      res.set("X-Field-Semantics-Count", String(fields.length));
      try {
        bindProducerIdentity(res, await retainNativeCandidate(input, scenario as NativeScenario, response, store));
        res.set("X-Producer-Binding-Status", "retained");
      } catch {
        // Archive availability is NOT numerical/source readiness. Preserve the
        // correct conditional response and explicitly refuse producer claims.
        res.set("X-Producer-Binding-Status", "unavailable-no-producer-attestation");
        res.set("X-Producer-Binding-Error", "Native retained material/source/result verification unavailable");
      }
      res.json(response);
    } catch (error) {
      res.status(422).json({ error: error instanceof Error ? error.message : "Invalid candidate inputs" });
    }
  };
}
