import { syncCuriusToDbStep, embedDbStep } from "@/app/steps/sync-steps";

export async function syncWorkflow() {
  "use workflow";
  await syncCuriusToDbStep();
  await embedDbStep();
  return true;
}
