(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  function dedupe(deps) {
    var newDeps = [];
    for (var i = 0, l = deps.length; i < l; i++)
      if (indexOf.call(newDeps, deps[i]) == -1)
        newDeps.push(deps[i])
    return newDeps;
  }

  function register(name, deps, declare, execute) {
    if (typeof name != 'string')
      throw "System.register provided no module name";

    var entry;

    // dynamic
    if (typeof declare == 'boolean') {
      entry = {
        declarative: false,
        deps: deps,
        execute: execute,
        executingRequire: declare
      };
    }
    else {
      // ES6 declarative
      entry = {
        declarative: true,
        deps: deps,
        declare: declare
      };
    }

    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry; 

    entry.deps = dedupe(entry.deps);

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }

  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;
      exports[name] = value;

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](exports);
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    if (!module.setters || !module.execute)
      throw new TypeError("Invalid System.register form for " + entry.name);

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        if (depEntry.module.exports && depEntry.module.exports.__esModule)
          depExports = depEntry.module.exports;
        else
          depExports = { 'default': depEntry.module.exports, __useDefault: true };
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    var module = entry.module.exports;

    if (!module || !entry.declarative && module.__esModule !== true)
      module = { 'default': module, __useDefault: true };

    // return the defined module object
    return modules[name] = module;
  };

  return function(mains, declare) {

    var System;
    var System = {
      register: register, 
      get: load, 
      set: function(name, module) {
        modules[name] = module; 
      },
      newModule: function(module) {
        return module;
      },
      global: global 
    };
    System.set('@empty', {});

    declare(System);

    for (var i = 0; i < mains.length; i++)
      load(mains[i]);
  }

})(typeof window != 'undefined' ? window : global)
/* (['mainModule'], function(System) {
  System.register(...);
}); */

(['js/main.jsx!github:floatdrop/plugin-jsx@1.2.1'], function(System) {

System.register("npm:core-js@0.9.18/library/modules/$.fw", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = function($) {
    $.FW = false;
    $.path = $.core;
    return $;
  };
  global.define = __define;
  return module.exports;
});

System.register("npm:core-js@0.9.18/library/modules/$.def", ["npm:core-js@0.9.18/library/modules/$"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var $ = require("npm:core-js@0.9.18/library/modules/$"),
      global = $.g,
      core = $.core,
      isFunction = $.isFunction;
  function ctx(fn, that) {
    return function() {
      return fn.apply(that, arguments);
    };
  }
  $def.F = 1;
  $def.G = 2;
  $def.S = 4;
  $def.P = 8;
  $def.B = 16;
  $def.W = 32;
  function $def(type, name, source) {
    var key,
        own,
        out,
        exp,
        isGlobal = type & $def.G,
        isProto = type & $def.P,
        target = isGlobal ? global : type & $def.S ? global[name] : (global[name] || {}).prototype,
        exports = isGlobal ? core : core[name] || (core[name] = {});
    if (isGlobal)
      source = name;
    for (key in source) {
      own = !(type & $def.F) && target && key in target;
      if (own && key in exports)
        continue;
      out = own ? target[key] : source[key];
      if (isGlobal && !isFunction(target[key]))
        exp = source[key];
      else if (type & $def.B && own)
        exp = ctx(out, global);
      else if (type & $def.W && target[key] == out)
        !function(C) {
          exp = function(param) {
            return this instanceof C ? new C(param) : C(param);
          };
          exp.prototype = C.prototype;
        }(out);
      else
        exp = isProto && isFunction(out) ? ctx(Function.call, out) : out;
      exports[key] = exp;
      if (isProto)
        (exports.prototype || (exports.prototype = {}))[key] = out;
    }
  }
  module.exports = $def;
  global.define = __define;
  return module.exports;
});

System.register("npm:core-js@0.9.18/library/modules/$.get-names", ["npm:core-js@0.9.18/library/modules/$"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var $ = require("npm:core-js@0.9.18/library/modules/$"),
      toString = {}.toString,
      getNames = $.getNames;
  var windowNames = typeof window == 'object' && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
  function getWindowNames(it) {
    try {
      return getNames(it);
    } catch (e) {
      return windowNames.slice();
    }
  }
  module.exports.get = function getOwnPropertyNames(it) {
    if (windowNames && toString.call(it) == '[object Window]')
      return getWindowNames(it);
    return getNames($.toObject(it));
  };
  global.define = __define;
  return module.exports;
});

System.register("npm:core-js@0.9.18/library/modules/$", ["npm:core-js@0.9.18/library/modules/$.fw"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var global = typeof self != 'undefined' ? self : Function('return this')(),
      core = {},
      defineProperty = Object.defineProperty,
      hasOwnProperty = {}.hasOwnProperty,
      ceil = Math.ceil,
      floor = Math.floor,
      max = Math.max,
      min = Math.min;
  var DESC = !!function() {
    try {
      return defineProperty({}, 'a', {get: function() {
          return 2;
        }}).a == 2;
    } catch (e) {}
  }();
  var hide = createDefiner(1);
  function toInteger(it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  }
  function desc(bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  }
  function simpleSet(object, key, value) {
    object[key] = value;
    return object;
  }
  function createDefiner(bitmap) {
    return DESC ? function(object, key, value) {
      return $.setDesc(object, key, desc(bitmap, value));
    } : simpleSet;
  }
  function isObject(it) {
    return it !== null && (typeof it == 'object' || typeof it == 'function');
  }
  function isFunction(it) {
    return typeof it == 'function';
  }
  function assertDefined(it) {
    if (it == undefined)
      throw TypeError("Can't call method on  " + it);
    return it;
  }
  var $ = module.exports = require("npm:core-js@0.9.18/library/modules/$.fw")({
    g: global,
    core: core,
    html: global.document && document.documentElement,
    isObject: isObject,
    isFunction: isFunction,
    that: function() {
      return this;
    },
    toInteger: toInteger,
    toLength: function(it) {
      return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0;
    },
    toIndex: function(index, length) {
      index = toInteger(index);
      return index < 0 ? max(index + length, 0) : min(index, length);
    },
    has: function(it, key) {
      return hasOwnProperty.call(it, key);
    },
    create: Object.create,
    getProto: Object.getPrototypeOf,
    DESC: DESC,
    desc: desc,
    getDesc: Object.getOwnPropertyDescriptor,
    setDesc: defineProperty,
    setDescs: Object.defineProperties,
    getKeys: Object.keys,
    getNames: Object.getOwnPropertyNames,
    getSymbols: Object.getOwnPropertySymbols,
    assertDefined: assertDefined,
    ES5Object: Object,
    toObject: function(it) {
      return $.ES5Object(assertDefined(it));
    },
    hide: hide,
    def: createDefiner(0),
    set: global.Symbol ? simpleSet : hide,
    each: [].forEach
  });
  if (typeof __e != 'undefined')
    __e = core;
  if (typeof __g != 'undefined')
    __g = global;
  global.define = __define;
  return module.exports;
});

System.register("npm:core-js@0.9.18/library/modules/es6.object.statics-accept-primitives", ["npm:core-js@0.9.18/library/modules/$", "npm:core-js@0.9.18/library/modules/$.def", "npm:core-js@0.9.18/library/modules/$.get-names"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var $ = require("npm:core-js@0.9.18/library/modules/$"),
      $def = require("npm:core-js@0.9.18/library/modules/$.def"),
      isObject = $.isObject,
      toObject = $.toObject;
  $.each.call(('freeze,seal,preventExtensions,isFrozen,isSealed,isExtensible,' + 'getOwnPropertyDescriptor,getPrototypeOf,keys,getOwnPropertyNames').split(','), function(KEY, ID) {
    var fn = ($.core.Object || {})[KEY] || Object[KEY],
        forced = 0,
        method = {};
    method[KEY] = ID == 0 ? function freeze(it) {
      return isObject(it) ? fn(it) : it;
    } : ID == 1 ? function seal(it) {
      return isObject(it) ? fn(it) : it;
    } : ID == 2 ? function preventExtensions(it) {
      return isObject(it) ? fn(it) : it;
    } : ID == 3 ? function isFrozen(it) {
      return isObject(it) ? fn(it) : true;
    } : ID == 4 ? function isSealed(it) {
      return isObject(it) ? fn(it) : true;
    } : ID == 5 ? function isExtensible(it) {
      return isObject(it) ? fn(it) : false;
    } : ID == 6 ? function getOwnPropertyDescriptor(it, key) {
      return fn(toObject(it), key);
    } : ID == 7 ? function getPrototypeOf(it) {
      return fn(Object($.assertDefined(it)));
    } : ID == 8 ? function keys(it) {
      return fn(toObject(it));
    } : require("npm:core-js@0.9.18/library/modules/$.get-names").get;
    try {
      fn('z');
    } catch (e) {
      forced = 1;
    }
    $def($def.S + $def.F * forced, 'Object', method);
  });
  global.define = __define;
  return module.exports;
});

System.register("npm:core-js@0.9.18/library/fn/object/keys", ["npm:core-js@0.9.18/library/modules/es6.object.statics-accept-primitives", "npm:core-js@0.9.18/library/modules/$"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  require("npm:core-js@0.9.18/library/modules/es6.object.statics-accept-primitives");
  module.exports = require("npm:core-js@0.9.18/library/modules/$").core.Object.keys;
  global.define = __define;
  return module.exports;
});

System.register("npm:babel-runtime@5.8.38/core-js/object/keys", ["npm:core-js@0.9.18/library/fn/object/keys"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": require("npm:core-js@0.9.18/library/fn/object/keys"),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

System.register('js/socket', [], function (_export) {
  'use strict';

  var host, socket;
  return {
    setters: [],
    execute: function () {
      host = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
      socket = io.connect(host);

      _export('default', socket);
    }
  };
});
System.register('js/components/brick.jsx!github:floatdrop/plugin-jsx@1.2.1', ['js/socket'], function (_export) {
  'use strict';

  var socket, perRow, Brick;
  return {
    setters: [function (_jsSocket) {
      socket = _jsSocket['default'];
    }],
    execute: function () {
      perRow = 13;
      Brick = React.createClass({ displayName: "Brick",
        getInitialState: function getInitialState() {
          return {
            destroyed: false,
            destroyer: '',
            showName: false
          };
        },

        componentDidMount: function componentDidMount() {
          var _this = this;

          socket.on('reset', function () {
            return _this.setState({
              destroyed: false,
              destroyer: '',
              showName: false
            });
          });

          socket.on('smash', function (event) {
            if (event.destroyed.indexOf(_this.props.num) !== -1) {
              _this.setState({ destroyed: true });
            }

            if (event.brick === _this.props.num) {
              _this.setState({
                destroyed: true,
                destroyer: event.player,
                showName: true
              });

              setTimeout(function () {
                _this.setState({
                  showName: false
                });
              }, 1000);
            }
          });
        },

        handleClick: function handleClick() {
          if (!this.state.destroyed) {
            this.setState({ destroyed: true });
            this.props.onClick();
          }
        },

        render: function render() {
          var row = Math.floor(this.props.num / (perRow + 1));
          var offset = row % 2 === 0;

          return React.createElement("div", { className: 'brick ' + (this.props.destroyed || this.state.destroyed ? 'destroyed ' : '') + (offset ? 'offset' : ''),
            onClick: this.handleClick }, React.createElement("span", { className: "player-name" }, this.state.showName && this.state.destroyer));
        }
      });

      _export('default', Brick);
    }
  };
});
System.register('js/components/name.jsx!github:floatdrop/plugin-jsx@1.2.1', ['js/socket'], function (_export) {
  'use strict';

  var socket, NameEntry;
  return {
    setters: [function (_jsSocket) {
      socket = _jsSocket['default'];
    }],
    execute: function () {
      NameEntry = React.createClass({ displayName: "NameEntry",
        getInitialState: function getInitialState() {
          return {
            name: ''
          };
        },

        updateName: function updateName(event) {
          this.setState({
            name: event.target.value
          });
        },

        submit: function submit() {
          this.props.onSubmit(this.state.name);
        },

        render: function render() {
          return React.createElement("div", null, React.createElement("section", { className: "name-entry" }, React.createElement("input", { value: this.state.name, onChange: this.updateName,
            placeholder: "enter your name" })), React.createElement("section", { className: "submit-button" }, this.props.active && this.state.name && React.createElement("div", null, React.createElement("button", { onClick: this.submit }, "PLAY"))));
        }
      });

      _export('default', NameEntry);
    }
  };
});
System.register("js/components/scores.jsx!github:floatdrop/plugin-jsx@1.2.1", ["npm:babel-runtime@5.8.38/core-js/object/keys"], function (_export) {
  var _Object$keys, price, Scores;

  return {
    setters: [function (_npmBabelRuntime5838CoreJsObjectKeys) {
      _Object$keys = _npmBabelRuntime5838CoreJsObjectKeys["default"];
    }],
    execute: function () {
      "use strict";

      price = function price(pence) {
        return pence / 100;
      };

      Scores = React.createClass({ displayName: "Scores",
        render: function render() {
          var scores = this.props.scores;

          var players = _Object$keys(scores).sort(function (a, b) {
            return scores[b] - scores[a];
          });

          var total = players.reduce(function (total, player) {
            return total + scores[player];
          }, 0);

          return React.createElement("div", { className: "scores" }, React.createElement("h1", null, "TOTAL DONATIONS: £", price(total)), React.createElement("ol", null, players.map(function (player) {
            return React.createElement("li", null, player + ': £' + price(scores[player]));
          })));
        }
      });

      _export("default", Scores);
    }
  };
});
System.register('js/components/wall.jsx!github:floatdrop/plugin-jsx@1.2.1', ['js/components/brick.jsx!github:floatdrop/plugin-jsx@1.2.1', 'js/components/scores.jsx!github:floatdrop/plugin-jsx@1.2.1', 'js/socket'], function (_export) {
  'use strict';

  var Brick, Scores, socket, Wall;
  return {
    setters: [function (_jsComponentsBrickJsxGithubFloatdropPluginJsx121) {
      Brick = _jsComponentsBrickJsxGithubFloatdropPluginJsx121['default'];
    }, function (_jsComponentsScoresJsxGithubFloatdropPluginJsx121) {
      Scores = _jsComponentsScoresJsxGithubFloatdropPluginJsx121['default'];
    }, function (_jsSocket) {
      socket = _jsSocket['default'];
    }],
    execute: function () {
      Wall = React.createClass({ displayName: "Wall",
        destroyBrick: function destroyBrick(x) {
          return socket.emit('smash', {
            brick: x,
            player: this.props.name
          });
        },

        render: function render() {
          var _this = this;

          return React.createElement("div", { className: "wall" }, !this.props.active && React.createElement(Scores, { scores: this.props.scores }), this.props.bricks.map(function (x) {
            var destroyed = _this.props.destroyed.indexOf(x) !== -1;
            return React.createElement(Brick, { key: x, num: x, onClick: _this.destroyBrick.bind(_this, x), destroyed: destroyed });
          }));
        }
      });

      _export('default', Wall);
    }
  };
});
System.register('js/main.jsx!github:floatdrop/plugin-jsx@1.2.1', ['js/components/name.jsx!github:floatdrop/plugin-jsx@1.2.1', 'js/components/wall.jsx!github:floatdrop/plugin-jsx@1.2.1', 'js/socket'], function (_export) {
  'use strict';

  var NameEntry, Wall, socket, NAME_ENTRY, GAME, numBricks, arr, i, destroyed, Game;
  return {
    setters: [function (_jsComponentsNameJsxGithubFloatdropPluginJsx121) {
      NameEntry = _jsComponentsNameJsxGithubFloatdropPluginJsx121['default'];
    }, function (_jsComponentsWallJsxGithubFloatdropPluginJsx121) {
      Wall = _jsComponentsWallJsxGithubFloatdropPluginJsx121['default'];
    }, function (_jsSocket) {
      socket = _jsSocket['default'];
    }],
    execute: function () {
      NAME_ENTRY = 0;
      GAME = 1;
      numBricks = 500;
      arr = [];

      for (i = 0; i < numBricks; i++) {
        arr.push(i);
      }

      destroyed = [];
      Game = React.createClass({ displayName: "Game",
        getInitialState: function getInitialState() {
          return {
            active: false,
            state: NAME_ENTRY,
            name: '',
            destroyed: [],
            scores: {}
          };
        },

        componentDidMount: function componentDidMount() {
          var _this = this;

          socket.on('reset', function () {
            return _this.setState({
              active: true,
              destroyed: [],
              scores: {}
            });
          });

          socket.on('init', function (event) {
            _this.setState({
              destroyed: event.destroyed,
              active: event.active,
              scores: event.scores
            });
          });

          socket.on('start', function () {
            _this.setState({ active: true });
          });

          socket.on('stop', function (event) {
            _this.setState({
              active: false,
              scores: event.scores
            });
          });
        },

        setName: function setName(name) {
          this.setState({
            state: GAME,
            name: name
          });
        },

        render: function render() {
          return this.state.state === NAME_ENTRY ? React.createElement(NameEntry, { active: this.state.active, onSubmit: this.setName }) : React.createElement(Wall, { active: this.state.active,
            scores: this.state.scores,
            bricks: this.props.bricks,
            name: this.state.name,
            destroyed: this.state.destroyed });
        }
      });

      ReactDOM.render(React.createElement(Game, { bricks: arr }), document.getElementById('wall'));
    }
  };
});
});
//# sourceMappingURL=build.js.map