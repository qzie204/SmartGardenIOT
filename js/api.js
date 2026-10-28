/* REST API và WebSocket. Không tạo dữ liệu cảm biến hoặc xác nhận giả. */
(function () {
  const listeners = {};
  let token = SG.storage.get('sg_token') || SG.storage.get('sg_token', 'sessionStorage') || '';
  let currentUser = null;
  let socket = null;
  let reconnectTimer = null;
  let sending = false;
  let liveRevision = 0;
  let refreshNumber = 0;
  let statusRevision = 0;
  const completed = new Set();
  const state = SG.state = {
    ready: false,
    online: false,
    busy: false,
    updated: 0,
    readings: [],
    commands: [],
    user: null,
    dev: {
      light: { on: false, known: false, pending: false },
      pump: { on: false, known: false, pending: false }
    }
  };

  SG.on = function subscribe(event, callback) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  };

  SG.emit = function emit(event, payload) {
    if (!listeners[event]) {
      return;
    }
    for (const callback of listeners[event]) {
      callback(payload);
    }
  };

  function clearSession() {
    token = '';
    currentUser = null;
    clearTimeout(reconnectTimer);
    SG.storage.remove('sg_token');
    SG.storage.remove('sg_token', 'sessionStorage');
    if (socket) {
      socket.close();
      socket = null;
    }
    state.online = false;
  }

  async function request(path, method = 'GET', body) {
    const headers = {};
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    const options = { method, headers, signal: AbortSignal.timeout(30000) };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch('/api/v1' + path, options);
    } catch (_) {
      throw new Error('Không kết nối được backend. Hãy chạy npm start và mở http://localhost:8080.');
    }
    let result;
    try {
      result = await response.json();
    } catch (_) {
      throw new Error('Phản hồi không phải JSON. Hãy mở trang qua backend ở cổng 8080.');
    }
    if (!response.ok) {
      const error = new Error(result.error || 'Yêu cầu chưa thực hiện được.');
      error.status = response.status;
      error.data = result.data;
      if (response.status === 401 && token && path !== '/auth/login') {
        clearSession();
        SG.emit('expired');
      }
      throw error;
    }
    return result.data;
  }

  function updateStatus(status) {
    state.online = status.online;
    state.busy = status.busy;
    state.updated = status.lastSensorAt;
    SG.emit('status');
  }

  function updateDevices(snapshot) {
    for (const device of snapshot.devices) {
      const item = state.dev[device.device_key];
      if (!item) {
        continue;
      }
      item.on = device.current_status === 'on';
      item.known = device.current_status !== null;
      item.pending = device.pending;
    }
    updateStatus(snapshot.status);
  }

  function updateReadings(readings) {
    const unique = new Map();
    for (const reading of [...readings, ...state.readings]) {
      unique.set(reading.id, reading);
    }
    state.readings = Array.from(unique.values()).sort(function newestFirst(left, right) {
      return right.ts - left.ts || right.id - left.id;
    }).slice(0, 45);
    state.ready = true;
    SG.emit('data');
  }

  function updateCommand(command, notify = true) {
    const index = state.commands.findIndex(function sameCommand(item) {
      return item.id === command.id;
    });
    if (index >= 0) {
      state.commands[index] = command;
    } else {
      state.commands.push(command);
    }
    state.commands.sort(function newestFirst(left, right) {
      return right.id - left.id;
    });
    state.commands = state.commands.slice(0, 100);
    const device = state.dev[command.device];
    device.pending = command.result === 'pending';
    if (command.result === 'success') {
      device.on = command.action === 'on';
      device.known = true;
    } else if (command.result !== 'pending') {
      device.known = false;
    }
    SG.emit('cmd');
    if (notify && command.result !== 'pending' && !completed.has(command.id)) {
      completed.add(command.id);
      if (completed.size > 500) {
        completed.delete(completed.values().next().value);
      }
      SG.emit('complete', command);
    }
  }

  async function refresh() {
    refreshNumber += 1;
    const currentRefresh = refreshNumber;
    const revisionAtStart = liveRevision;
    const statusAtStart = statusRevision;
    const [readings, devices, commands] = await Promise.all([
      request('/sensors/latest?limit=15'), request('/devices'), request('/actions?limit=20')
    ]);
    if (currentRefresh !== refreshNumber) {
      return;
    }
    updateReadings(readings);
    // Không để snapshot HTTP cũ ghi đè trạng thái vừa nhận qua WebSocket.
    if (revisionAtStart !== liveRevision) {
      return;
    }
    if (statusAtStart !== statusRevision) {
      devices.status = {
        online: state.online,
        busy: state.busy,
        lastSensorAt: state.updated
      };
    }
    updateDevices(devices);
    // Snapshot chỉ dựng lịch sử; không phát thông báo cho lệnh cũ.
    state.commands = commands.items;
    SG.emit('cmd');
  }

  function connectSocket() {
    if (!token || socket) {
      return;
    }
    let protocol = 'ws:';
    if (location.protocol === 'https:') {
      protocol = 'wss:';
    }
    const connection = new WebSocket(protocol + '//' + location.host + '/ws');
    socket = connection;
    connection.onopen = function authenticateSocket() {
      connection.send(JSON.stringify({ type: 'auth', token }));
    };
    connection.onmessage = function receiveEvent(event) {
      const message = JSON.parse(event.data);
      if (message.type === 'command' || message.type === 'devices') {
        liveRevision += 1;
      }
      if (message.type === 'status') {
        statusRevision += 1;
      }
      if (message.type === 'ready') {
        updateStatus(message.data);
        refresh().catch(function refreshFailed(error) {
          SG.toast(error.message, 'error');
        });
      } else if (message.type === 'sensors') {
        updateReadings(message.data);
      } else if (message.type === 'command') {
        updateCommand(message.data);
      } else if (message.type === 'devices') {
        updateDevices(message.data);
      } else if (message.type === 'status') {
        updateStatus(message.data);
      }
    };
    connection.onclose = function reconnect(event) {
      if (socket !== connection) {
        return;
      }
      socket = null;
      state.online = false;
      SG.emit('status');
      if (event.code === 4401) {
        clearSession();
        SG.emit('expired');
        return;
      }
      if (token) {
        reconnectTimer = setTimeout(connectSocket, 3000);
      }
    };
  }

  async function login(username, password, remember) {
    const result = await request('/auth/login', 'POST', { username, password });
    clearSession();
    token = result.token;
    currentUser = result.user;
    let storage = 'sessionStorage';
    if (remember) {
      storage = 'localStorage';
    }
    SG.storage.set('sg_token', token, storage);
    state.readings = [];
    state.commands = [];
    completed.clear();
    await refresh();
    connectSocket();
    return result;
  }

  async function restore() {
    if (!token) {
      return null;
    }
    currentUser = await request('/users/me');
    await refresh();
    connectSocket();
    return currentUser;
  }

  async function send(device) {
    if (!state.online || state.busy || sending || !state.dev[device]) {
      return;
    }
    sending = true;
    state.busy = true;
    state.dev[device].pending = true;
    SG.emit('status');
    let key = 'led1';
    if (device === 'light') {
      key = 'led2';
    }
    let action = 'on';
    if (state.dev[device].on && state.dev[device].known) {
      action = 'off';
    }
    try {
      const commands = await request('/devices/control', 'POST', { [key]: action });
      commands.forEach(function receiveResult(command) {
        updateCommand(command);
      });
    } catch (error) {
      if (Array.isArray(error.data)) {
        error.data.forEach(function receiveFailure(command) {
          updateCommand(command);
        });
      } else {
        SG.toast(error.message, 'error');
      }
    } finally {
      sending = false;
      state.dev[device].pending = false;
      try {
        updateDevices(await request('/devices'));
      } catch (_) {
        state.online = false;
        SG.emit('status');
      }
    }
  }

  SG.api = {
    login,
    restore,
    refresh,
    send,
    request,
    userInfo() {
      if (currentUser) {
        return currentUser.profile;
      }
      return {};
    },
    register(body) {
      return request('/auth/register', 'POST', body);
    },
    forgot(value) {
      return request('/auth/forgot', 'POST', { account: value });
    },
    async saveProfile(profile) {
      currentUser = await request('/profile', 'PUT', profile);
      return currentUser.profile;
    },
    async logout() {
      try {
        await request('/auth/logout', 'POST');
      } finally {
        clearSession();
      }
    }
  };
})();
