window.myViewModel = {
	name: "Gerald",
	nameIsAwesome: true,
	items: [
		{ name:"Sandwich", amount: 2.25 },
		{ name:"Fries", amount: 1.00 },
		{ name:"Soda", amount: 1.55 },
		{ name:"Shards of Glass", amount: 0.10 },
		{ name:"Screwdriver", amount: 5.00 }
	],
	selectedItem : null,
	selectedItems : [],
	selectionText : ""
};

Observable.On(); // turn on connection to DOM

// some late binding...
Observable.Watch({
	model: myViewModel,
	property: "nameIsAwesome",
	callback: function(o, v) {
		//console.log( v ? "AWESOME" : "NOT AWESOME");
	}
});

function calculateSelectionMessage(o, v) {
	//console.log("Generating selected items message");
	var message = "";
	if (myViewModel.selectedItems.length) {
		var names = [];
		for (var i = 0; i < myViewModel.selectedItems.length; i++) {
			names.push(myViewModel.selectedItems[i].name);
		}
		message = names.join(", ");
		message = message;
	}
	myViewModel.selectionText = message;
}

Observable.Watch({
		model: myViewModel,
		property: "selectedItems",
		callback: calculateSelectionMessage
});