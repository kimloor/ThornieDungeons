async function cloudGet(url, params) {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`);
    return await res.json();
  } catch (e) {
    return {
      error: "network_error"
    };
  }
}
async function cloudPost(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    return {
      error: "network_error"
    };
  }
}
function cloudLogin(url, id, password) {
  return cloudGet(url, {
    action: "login",
    id,
    password
  });
}
function cloudRegister(url, id, password) {
  return cloudPost(url, {
    action: "register",
    id,
    password
  });
}
function cloudSaveProgress(url, id, password, progress) {
  return cloudPost(url, {
    action: "saveProgress",
    id,
    password,
    progress
  });
}
function cloudSyncItems(url, id, password, items) {
  return cloudPost(url, {
    action: "syncItems",
    id,
    password,
    items
  });
}
function cloudSaveRunState(url, id, password, runState) {
  return cloudPost(url, {
    action: "saveRunState",
    id,
    password,
    runState
  });
}
function cloudGetConfig(url) {
  return cloudGet(url, {
    action: "getGameConfig"
  });
}
