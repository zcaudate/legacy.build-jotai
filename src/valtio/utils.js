'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var proxyCompare = require('proxy-compare');
var vanilla = require('./vanilla');

var subscribeKey = function subscribeKey(proxyObject, key, callback, notifyInSync) {
  var prevValue = proxyObject[key];
  return vanilla.subscribe(proxyObject, function () {
    var nextValue = proxyObject[key];

    if (!Object.is(prevValue, nextValue)) {
      callback(prevValue = nextValue);
    }
  }, notifyInSync);
};
var devtools = function devtools(proxyObject, name) {
  var extension;

  try {
    extension = window.__REDUX_DEVTOOLS_EXTENSION__;
  } catch (_unused) {}

  if (!extension) {
    if (typeof process === 'object' && process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.warn('[Warning] Please install/enable Redux devtools extension');
    }

    return;
  }

  var isTimeTraveling = false;
  var devtools = extension.connect({
    name: name
  });
  var unsub1 = vanilla.subscribe(proxyObject, function () {
    if (isTimeTraveling) {
      isTimeTraveling = false;
    } else {
      devtools.send("Update - " + new Date().toLocaleString(), vanilla.snapshot(proxyObject));
    }
  });
  var unsub2 = devtools.subscribe(function (message) {
    var _message$payload3, _message$payload4;

    if (message.type === 'DISPATCH' && message.state) {
      var _message$payload, _message$payload2;

      if (((_message$payload = message.payload) == null ? void 0 : _message$payload.type) === 'JUMP_TO_ACTION' || ((_message$payload2 = message.payload) == null ? void 0 : _message$payload2.type) === 'JUMP_TO_STATE') {
        isTimeTraveling = true;
      }

      var nextValue = JSON.parse(message.state);
      Object.keys(nextValue).forEach(function (key) {
        proxyObject[key] = nextValue[key];
      });
    } else if (message.type === 'DISPATCH' && ((_message$payload3 = message.payload) == null ? void 0 : _message$payload3.type) === 'COMMIT') {
      devtools.init(vanilla.snapshot(proxyObject));
    } else if (message.type === 'DISPATCH' && ((_message$payload4 = message.payload) == null ? void 0 : _message$payload4.type) === 'IMPORT_STATE') {
      var _message$payload$next, _message$payload$next2;

      var actions = (_message$payload$next = message.payload.nextLiftedState) == null ? void 0 : _message$payload$next.actionsById;
      var computedStates = ((_message$payload$next2 = message.payload.nextLiftedState) == null ? void 0 : _message$payload$next2.computedStates) || [];
      isTimeTraveling = true;
      computedStates.forEach(function (_ref, index) {
        var state = _ref.state;
        var action = actions[index] || "Update - " + new Date().toLocaleString();
        Object.keys(state).forEach(function (key) {
          proxyObject[key] = state[key];
        });

        if (index === 0) {
          devtools.init(vanilla.snapshot(proxyObject));
        } else {
          devtools.send(action, vanilla.snapshot(proxyObject));
        }
      });
    }
  });
  devtools.init(vanilla.snapshot(proxyObject));
  return function () {
    unsub1();
    unsub2();
  };
};
var addComputed = function addComputed(proxyObject, computedFns, targetObject) {
  if (targetObject === void 0) {
    targetObject = proxyObject;
  }
  Object.keys(computedFns).forEach(function (key) {
    if (Object.getOwnPropertyDescriptor(targetObject, key)) {
      throw new Error('object property already defined');
    }

    var get = computedFns[key];
    var prevSnapshot;
    var affected = new WeakMap();
    var pending = false;

    var callback = function callback() {
      var nextSnapshot = vanilla.snapshot(proxyObject);

      if (!pending && (!prevSnapshot || proxyCompare.isDeepChanged(prevSnapshot, nextSnapshot, affected))) {
        affected = new WeakMap();
        var value = get(proxyCompare.createDeepProxy(nextSnapshot, affected));
        prevSnapshot = nextSnapshot;

        if (value instanceof Promise) {
          pending = true;
          value.then(function (v) {
            targetObject[key] = v;
          }).catch(function (e) {
            targetObject[key] = new Proxy({}, {
              get: function get() {
                throw e;
              }
            });
          }).finally(function () {
            pending = false;
          });
        }

        targetObject[key] = value;
      }
    };

    vanilla.subscribe(proxyObject, callback);
    callback();
  });
};
var proxyWithComputed = function proxyWithComputed(initialObject, computedFns) {
  Object.keys(computedFns).forEach(function (key) {
    if (Object.getOwnPropertyDescriptor(initialObject, key)) {
      throw new Error('object property already defined');
    }

    var computedFn = computedFns[key];

    var _ref2 = typeof computedFn === 'function' ? {
      get: computedFn
    } : computedFn,
        get = _ref2.get,
        set = _ref2.set;

    var computedValue;
    var prevSnapshot;
    var affected = new WeakMap();
    var desc = {};

    desc.get = function () {
      var nextSnapshot = vanilla.snapshot(proxyObject);

      if (!prevSnapshot || proxyCompare.isDeepChanged(prevSnapshot, nextSnapshot, affected)) {
        affected = new WeakMap();
        computedValue = get(proxyCompare.createDeepProxy(nextSnapshot, affected));
        prevSnapshot = nextSnapshot;
      }

      return computedValue;
    };

    if (set) {
      desc.set = function (newValue) {
        return set(proxyObject, newValue);
      };
    }

    Object.defineProperty(initialObject, key, desc);
  });
  var proxyObject = vanilla.proxy(initialObject);
  return proxyObject;
};

exports.addComputed = addComputed;
exports.devtools = devtools;
exports.proxyWithComputed = proxyWithComputed;
exports.subscribeKey = subscribeKey;
