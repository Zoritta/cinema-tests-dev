// small wrappers for fetch, makes it a bit shorter to write
// fetch, delete and send data with get, del(ete), post and put

export async function get(url) {
  return await (await fetch(url)).json();
}

export async function post(url, data) {
  return await postAndPut(url, data, 'POST');
}

export async function put(url, data) {
  return await postAndPut(url, data, 'PUT');
}

// can't name the function 'delete' (reserved word)
export async function del(url) {
  return await (await fetch(url, { method: 'DELETE' })).json();
}

// helper for post and put (since they are mostly the same code)
async function postAndPut(url, data, method) {
  return await (await fetch(url, {
    method,
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  })).json();
}