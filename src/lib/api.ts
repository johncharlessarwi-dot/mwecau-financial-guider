const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
function readXsrfToken(): string {
  const item = document.cookie.split("; ").find(part => part.startsWith("XSRF-TOKEN="));
  return item ? decodeURIComponent(item.slice("XSRF-TOKEN=".length)) : "";
}
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  if (["POST","PUT","PATCH","DELETE"].includes(method)) {
    const csrf = await fetch(`${API_ORIGIN}/sanctum/csrf-cookie`,{credentials:"include",headers:{Accept:"application/json"}});
    if (!csrf.ok) throw new Error("Unable to establish a secure API session. Check the API URL and CORS settings.");
  }
  const headers = new Headers(options.headers);
  headers.set("Accept","application/json");
  if(options.body) headers.set("Content-Type","application/json");
  const token=readXsrfToken(); if(token) headers.set("X-XSRF-TOKEN",token);
  let response:Response;
  try { response=await fetch(`${API_ORIGIN}/api/v1${path}`,{...options,method,credentials:"include",headers}); }
  catch { throw new Error("The finance API could not be reached. Check your connection and try again."); }
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status===422&&body.errors){const first=Object.values(body.errors).flat()[0];throw new Error(typeof first==="string"?first:"Please check the information you entered.");}
    if(response.status===401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(body.message||"The request could not be completed.");
  }
  return body as T;
}
