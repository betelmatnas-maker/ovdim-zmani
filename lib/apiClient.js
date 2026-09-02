export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no JSON body (e.g. file download handled separately)
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `שגיאה (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
