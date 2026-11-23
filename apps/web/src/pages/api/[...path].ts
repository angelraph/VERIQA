import type { NextApiRequest, NextApiResponse } from "next";
import { app } from "@veriga/indexer";

/// The Veriga API (indexer, relayer, statements, traction) runs inside the
/// site as one serverless function, so there is no separate server to host.
export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 60,
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    app(req as never, res as never);
  });
}
