const ALLOWED_DIRECTORIES = ["control-center/", "firmware/", "dashboards/"];

function objectKey(requestUrl) {
  let path;
  try {
    path = decodeURIComponent(new URL(requestUrl).pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }

  if (!path || path.includes("\\")) return null;
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  if (path === "latest.ini") return path;
  return ALLOWED_DIRECTORIES.some((prefix) => path.startsWith(prefix)) ? path : null;
}

function fallbackContentType(key) {
  if (key.endsWith(".ini")) return "text/plain; charset=utf-8";
  if (key.endsWith(".dll")) return "application/octet-stream";
  if (key.endsWith(".uf2")) return "application/octet-stream";
  if (key.endsWith(".simhubdash")) return "application/zip";
  return "application/octet-stream";
}

function downloadName(key) {
  return key.substring(key.lastIndexOf("/") + 1).replace(/[^A-Za-z0-9._ -]/g, "_");
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" }
      });
    }

    const key = objectKey(request.url);
    if (!key) return new Response("Not found", { status: 404 });

    const object = request.method === "HEAD"
      ? await env.UPDATES.head(key)
      : await env.UPDATES.get(key);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", headers.get("Content-Type") || fallbackContentType(key));
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");

    if (key === "latest.ini") {
      headers.set("Cache-Control", "public, max-age=60, must-revalidate");
      headers.set("Content-Disposition", "inline");
    } else {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("Content-Disposition", `attachment; filename="${downloadName(key)}"`);
    }

    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  }
};
