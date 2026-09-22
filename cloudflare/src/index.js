const ALLOWED_DIRECTORIES = ["control-center/", "control-mapper/", "firmware/", "dashboards/"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

function parseManifest(text) {
  const values = new Map();
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const separator = line.indexOf("=");
    if (separator > 0 && !line.startsWith("#")) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return values;
}

function releaseEntry(values, kind, id, name, format, prefix) {
  const version = values.get(`${prefix}.version`);
  const url = values.get(`${prefix}.url`);
  const sha256 = values.get(`${prefix}.sha256`);
  if (!version || !url || !sha256) return null;
  return { kind, id, name, version, format, url, sha256 };
}

async function updateCatalog(env) {
  const manifestObject = await env.UPDATES.get("latest.ini");
  if (!manifestObject) return null;
  const values = parseManifest(await manifestObject.text());
  const entries = [];
  const software = [
    ["control-center", "VI Control Center"],
    ["control-mapper", "VI Control Mapper"],
  ];
  for (const [id, name] of software) {
    const entry = releaseEntry(values, "software", id, name, "DLL", id);
    if (entry) entries.push(entry);
  }

  const firmwareNames = {
    "vi-gt3": "VI-GT3",
    "equus-296-gtx": "EQUUS-296-GTX",
    "vi-rsr": "VI-RSR",
    "vi-cwbb": "VI-CWBB",
    "vi-296bb": "VI-296BB",
    "b7-ddu": "B7-DDU",
    "p8w-ddu": "P8W-DDU",
    "b5-ddu": "B5-DDU",
    "nova-evo": "NOVA-EVO",
    "vi-laptimer": "VI-LAPTIMER",
  };
  for (const [key] of values) {
    const match = /^firmware\.([^.]+)\.version$/.exec(key);
    if (!match) continue;
    const id = match[1];
    const entry = releaseEntry(values, "firmware", id, firmwareNames[id] || id.toUpperCase(), "UF2", `firmware.${id}`);
    if (entry) entries.push(entry);
  }

  for (const [key] of values) {
    const match = /^dashboard\.([^.]+)\.version$/.exec(key);
    if (!match) continue;
    const id = match[1];
    const configuredName = values.get(`dashboard.${id}.name`) || id.toUpperCase();
    const name = configuredName.replace(/\s+Dashboard$/i, "");
    const entry = releaseEntry(values, "dashboard", id, name, "SIMHUB", `dashboard.${id}`);
    if (entry) entries.push(entry);
  }
  return { format: 1, entries };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...CORS_HEADERS, Allow: "GET, HEAD, OPTIONS" }
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/catalog") {
      const catalog = await updateCatalog(env);
      if (!catalog) return new Response("Update manifest not found", { status: 404, headers: CORS_HEADERS });
      const headers = new Headers(CORS_HEADERS);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", "public, max-age=60, must-revalidate");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(request.method === "HEAD" ? null : JSON.stringify(catalog), { headers });
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
    for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);

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
