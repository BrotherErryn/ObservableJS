var Observable = (function() {

	"use strict";

	var _monitorIndex = 1;

	/* convert property to getter/setter if needed and add listener */
	/* { model: <object>, property: <string>, callback: <function> } */
	function _watch(options) {
		var model = options.model,
			prop = options.property,
			handler = options.callback;

		if(!model._listeners)
			model._listeners = {};

		if(model._listeners[prop] != null && handler) {
	    	if(model[prop].__wasExtended) {
	    		// extended array
	    		model[prop].__arrayCallbacks.push(handler);
	    	} else {
	    		model._listeners[prop].unshift(handler);
	    	}
	        return true;
	    }

	    var oldval = model[prop],
	        newval = oldval,
	        isArray = (Object.prototype.toString.call(model[prop]) === '[object Array]'),
	        getter = function () {
	            return newval;
	        },
	        setter = function (val) {
	        	var callbacks = oldval.__arrayCallbacks;

	        	oldval = newval;
	            newval = val;

				if(oldval == newval) return;

	            var max = model._listeners[prop].length;
	            while(max--) {
	            	var h = model._listeners[prop][max];
	            	h.call(model, oldval, val);
	            }

	            if(callbacks) {
	        		val = _extendArray(val, callbacks[0], model);
	        		val.__arrayCallbacks = callbacks;
	        		val.updated(val, model);
	        	}
	        };
	    
	    if (isArray) {
            model[prop] = _extendArray(model[prop], handler, model);
        }

	    if (delete model[prop]) { // can't watch constants
	        if (Object.defineProperty) { // ECMAScript 5
	            Object.defineProperty(model, prop, {
	                get: getter,
	                set: setter,
	                enumerable: false,
	                configurable: true
	            });
	        } else if (Object.prototype.__defineGetter__ && Object.prototype.__defineSetter__) { // legacy
	            Object.prototype.__defineGetter__.call(model, prop, getter);
	            Object.prototype.__defineSetter__.call(model, prop, setter);
	        }
	    }

		if(!model._listeners[prop]) model._listeners[prop] = [handler];
	    
	    return this;
	}

	/* remove listener and/or restore getter/setter to simple property */
	/* { model: <object>, property: <string>, callback: <function> } */
	/* Is this actually needed? May implement later... */
	/*
	function _forget(options) {

	}
	*/

	// Allows operations performed on an array instance to trigger bindings
	var _extendArray = function(arr, callback, model) {
	    if (arr.__wasExtended === true) return;

	    function generateOverloadedFunction(target, methodName, self) {
	        return function () {
	            var oldValue = Array.prototype.concat.apply(target);
	            var newValue = Array.prototype[methodName].apply(target, arguments);
	            target.updated(oldValue, model);
	            return newValue;
	        };
	    }
	    arr.updated = function (oldValue, self) {
	    	for (var i=0;i<arr.__arrayCallbacks.length;i++)
	    		arr.__arrayCallbacks[i].call(this, oldValue);
	    };
	    arr.concat = generateOverloadedFunction(arr, 'concat', model);
	    arr.join = generateOverloadedFunction(arr, 'join', model);
	    arr.pop = generateOverloadedFunction(arr, 'pop', model);
	    arr.push = generateOverloadedFunction(arr, 'push', model);
	    arr.reverse = generateOverloadedFunction(arr, 'reverse', model);
	    arr.shift = generateOverloadedFunction(arr, 'shift', model);
	    arr.slice = generateOverloadedFunction(arr, 'slice', model);
	    arr.sort = generateOverloadedFunction(arr, 'sort', model);
	    arr.splice = generateOverloadedFunction(arr, 'splice', model);
	    arr.unshift = generateOverloadedFunction(arr, 'unshift', model);
	    arr.__wasExtended = true;
	    arr.__arrayCallbacks = [callback];

	    return arr;
	}
	function _getDataContext(element, model) {
		// TODO: handle dot-notation entries
		var ctx = null, el = element;
		while(!ctx && el) {
			ctx = el._dataContext;
			el = el.parentNode;
			if(el && !el.getAttribute) el = null;
		}
		if(!ctx && model) {
			var sections = model.split('.');
			for(var i=0;i<sections.length;i++){
				ctx = (ctx || window)[sections[i]];
				if(!ctx)
					throw "Model definition invalid: " + sections[i] + " not found";
			}	
		}

		if(!ctx) 
			return null; //throw "Data context could not be determined.";

		if(!element._isConnected) {
			element._dataContext = ctx;
			element._isConnected = true;
		}
		return ctx;
	};

	function _parseDataCommands(options) {
		var sections = options.split(","),
			results = [];
		for(var i=0;i<sections.length;i++) {
			var kv = sections[i].split(':');
			if(kv.length != 2) {
				console.error("No binding property specified for action " + kv[0]);
			} else {
				results.push({
					action: kv[0].trim(), 
					property: kv[1].trim()
				});
			}
		}

		return results;
	}

	function _setInputValue(element, value, parentCollection) {
		var tn = element.tagName.toLowerCase();
		if(tn == "input") {
			var t = element.getAttribute("type");
			switch(t) {
				case "checkbox":
					element.checked = !!value;
					break;
				default:
					element.value = value;
					break;
			}
		} else if (tn == "select") {
			var items = element._dataContext[parentCollection],
				options = element.querySelectorAll('option');

			if(element.multiple) {
				for(var i=0;i<options.length;i++) {
					options[i].selected = false;
				}
				if(!value) return;
			}

			for(var i=0;i<items.length;i++) {
				var item = items[i];
				
				if(element.multiple) {
					for(var j=0;j<value.length;j++) {
						if(value[j] == item)
							options[i].selected = true;
					}
				} else {
					if(item == value) {
						element.selectedIndex = i;
					}
				}
			}
		}
	}

	function _bindInput(element, model, property, parentCollection) {
		var tn = element.tagName.toLowerCase(),
			evt = null,
			fn = null;

		if(tn == "input") {
			var	t = element.getAttribute("type");

			switch(t) {
				case "checkbox":
					evt = "click";
					fn = function() { 
						if(!this.element.getAttribute('data-monitor-id')) {
							// TODO: make this work...
							var self = this;
							//this.element.removeEventListener("click", fn, true);
							//this.element.removeEventListener("click", arguments.callee, false);
							setTimeout(function() {
								self.element.removeEventListener("click", fn, false);
							}, 1);
							return;
						}
						model[property] = element.checked; 
					};
					break;
				default:
					evt = "keyup";
					fn = function() { 
						var self = this;
						if(!this.element.getAttribute('data-monitor-id')) {
							setTimeout(function() {self.element.removeEventListener("keyup", fn, false);}, 1);
						}
						model[property] = element.value; 
					};
					break;
			}
		} else if (tn == "select") {
			evt = "change";
			fn = function() {
				var self = this;
				if(!this.element.getAttribute('data-monitor-id')) {
					setTimeout(function() {self.element.removeEventListener("change", fn, false);}, 1);
				}

				var dc = this.element._dataContext,
					options = this.element.querySelectorAll('option'),
					selectedOptions = Array.prototype.slice.call(options)
						.filter(function(ai) { return ai.selected; }),
					selectedValues = selectedOptions.map(function(item){
							return item._dataContext;
						});

				dc[property] = selectedValues;
			}
		}

		if(evt && fn) {
			element.addEventListener(
				evt, 
				fn.bind({
					element: element,
					model: model,
					property: property
				})
			);
		}
	}

	/* parse data-bind attributes and attach */
	function _on(rootElement) {
		var root = (rootElement || document),
			nodesToBind = root.querySelectorAll('[data-bind]');

		for(var i=0;i<nodesToBind.length;i++){
			var currentNode = nodesToBind[i],
				bindOptions = currentNode.getAttribute('data-bind'),
				bindSettings = _parseDataCommands(bindOptions);

			if(currentNode._isConnected) return; // already bound

			for(var j=0;j<bindSettings.length;j++) {
				var setting = bindSettings[j],
					context = _getDataContext(currentNode, setting.action=="model" ? setting.property : null);

				if(!context) continue; // this can happen when trying to process a node that was a foreach child

				var parentCollection = null;
				if(setting.action == "value") {
					for(var ii=0;ii<bindSettings.length;ii++) {
						if(bindSettings[ii].action=="foreach")
						parentCollection = bindSettings[ii].property;
					}
				}
				var	listenerData = {
						action : setting.action,
						element : currentNode,
						property: setting.property,
						parentCollection : parentCollection
					},
					listener = function() {
						var el = this.element,
							ctx = _getDataContext(el, null),
							value = ctx[this.property];

						switch(this.action) {
							case "text":
								el.textContent = value;
								break;
							case "html":
								el.innerHTML = value;
								break;
							case "value":
								_setInputValue(el, value, this.parentCollection);
								break;
							case "visible":
								el.style.display = !!value ? this.defaultState : 'none';
								break;
							case "foreach":
								var implementation = document.createDocumentFragment(),
									parentElement = this,
									bindCollection = function() {
										for(var idx = 0;idx<value.length;idx++) {
											var frag = parentElement.forEachTemplate.cloneNode(true);
											for(var n = 0; n<frag.childNodes.length; n++) {
												frag.childNodes[n]._dataContext = value[idx];
											}

											implementation.appendChild(frag);
										}
										el.appendChild(implementation);
										_on(el);
									};
								bindCollection();

								_watch({
									model : ctx,
									property : this.property,
									callback : function(o) {
										// empty array and rebind
										while(el.childNodes.length) {
											el.removeChild(el.lastChild);
										}
										bindCollection();
									}
								});
								break;
							default:
								break;

						}
					};
					listener.monitorID = _monitorIndex++;
					currentNode.setAttribute('data-monitor-id', listener.monitorID);

				switch(setting.action) {
					case "visible":
						listenerData.defaultState = getComputedStyle(currentNode).display;
						break;
					case "foreach":
						var template = document.createDocumentFragment(),
							nodeCount = currentNode.childNodes.length;

						for(var idx=0;idx<nodeCount;idx++) {
							if(currentNode.childNodes[idx].nodeType == 1)
								template.appendChild(currentNode.childNodes[idx].cloneNode(true));
						}

						listenerData.forEachTemplate = template;

						while(currentNode.childNodes.length)
							currentNode.removeChild(currentNode.lastChild);

						break;
					default:
						break;
				}

				if(listener) {
					var scoped = listener.bind(listenerData);
					scoped.monitorID = listener.monitorID;

					scoped();
					if(setting.action != "model") {
						_watch({
							model: context,
							property: setting.property,
							callback: scoped
						});
					}

					if(setting.action == "value") {
						_bindInput(currentNode, context, setting.property, parentCollection);
					}
				}
			}
		}
	}

	/* detach data-bind interfaces */
	function _off() {
		var elements = [], key = '[data-monitor-id]';
		switch(arguments.length) {
			case 0:
				elements = document.querySelectorAll(key);
				break;
			case 1:
				elements = Array.prototype.slice.call(arguments[0].querySelectorAll(key));
				elements.push(arguments[0]);
			default:
				if(!arguments[1])
					elements = [arguments[0]];
		}
		
		for(var i=0;i<elements.length;i++) {
			var el = elements[i],
				mid = el.getAttribute('data-monitor-id'),
				ctx = mid._dataContext || _getDataContext(el, null);

			if(ctx) {
				for (var k in ctx._listeners) {
					if(ctx.hasOwnProperty(k)) {
						var batch = ctx._listeners[k];
						for(var j=0;j<batch.length;j++) {
							if(batch[j].monitorID == mid)
								ctx._listeners[k].splice(j, 1);
						}
					}
				}		
			}

			el.removeAttribute('data-monitor-id');
		}
	}

	return {
		Watch : _watch,
		On : _on,
		Off : _off
	}
})();
