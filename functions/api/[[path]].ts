import worker, { type Env } from '../../worker/index';
// Pages Functions runs the same tenant-safe API as the standalone Worker.
export const onRequest: PagesFunction<Env> = context => worker.fetch(context.request, context.env, { waitUntil: p => context.waitUntil(p), passThroughOnException: () => context.passThroughOnException() } as ExecutionContext);
