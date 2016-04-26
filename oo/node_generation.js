/**
	NodeGeneration object.
	Constructor adds itself to its home canvas's node_generation dict
*/
GLO.NodeGeneration = function(canvas, nodes, is_aggregated){
	this.canvas = canvas
	this.nodes = nodes
	this.is_aggregated = is_aggregated || false

	this.gen_id = this.canvas.glo._next_node_gen()

	this.canvas.node_generations[this.gen_id] = this

	this.edge_generation_listeners = new Set()

	this.x_scale = d3.scale.linear()
		.range([this.canvas.left(),this.canvas.right()])
		.domain([0,1])

	this.y_scale = d3.scale.linear()
		.range([this.canvas.bottom(),this.canvas.top()])
		.domain([0,1])

	return this
}

GLO.NodeGeneration.prototype.default_r = 5
GLO.NodeGeneration.prototype.default_fill = "#333"
GLO.NodeGeneration.prototype.max_r = 45
GLO.NodeGeneration.prototype.min_r = 2
GLO.NodeGeneration.prototype.discrete_range_padding = 1.0;




GLO.NodeGeneration.prototype.get_root_source_gen = function(){
	if(!this.is_aggregated){
		return this
	}
	return this.aggregate_source_generation.get_root_source_gen()
}


GLO.NodeGeneration.prototype.aggregate = function(attr, method){
	var self = this

	var agg_fn
	if(method.toLowerCase()=="sum"){
		agg_fn = d3.sum
	}else if(method.toLowerCase()=="mean"){
		agg_fn = d3.mean
	}else if(method.toLowerCase()=="median"){
		agg_fn = d3.median
	}else{
		throw "Unrecognized aggregation method. Not aggregating."
		return this
	}

	var key_fn
	if(typeof attr == "string"){
		key_fn = function(d,attr){
			return d[attr]
		}
	}else{// attr is list
		key_fn = function(d,attrs){
			var str = ""
			for(var attr in attrs){
				attr = attrs[attr]
				str+=d[attr]+"&"
			}
			return str
		}
	}

	var agg_nodes = new Map()
	this.nodes.forEach(function(d){
		var key = key_fn(d,attr)
		if(!agg_nodes[key]){
			agg_nodes[key] = []
		}
		agg_nodes[key].push(d)
	})



	var new_nodes = new Map()
	for(var key in agg_nodes){
		var list = agg_nodes[key]

		var new_node = {}

		new_node.x_list = new Map()
		new_node.y_list = new Map()
		new_node.r_list = new Map()
		new_node.rho_list = new Map()
		new_node.theta_list = new Map()
		new_node.hover_list = new Map()
		new_node.fill_list = new Map()

		new_nodes.set(key, new_node)
	}

	var new_nodes_arr = [...new_nodes.values()]

	var agg_gen = new GLO.NodeGeneration(this.canvas, new_nodes_arr, true)
	agg_gen.aggregate_node_map = new Map() //(node in this gen,past gen) --> list(nodes in old gen)


	//Update properties from this to the aggregate
	agg_gen.aggregate_source_generation = this
	agg_gen.x_scale = this.x_scale.copy()
	agg_gen.y_scale = this.y_scale.copy()
	// agg_gen.aggregate_source_generation.shift(this)

	var id_counter = 0
	for(var key in agg_nodes){
		var list = agg_nodes[key]
		var new_node = new_nodes.get(key)


		agg_gen.aggregate_node_map.set(new_node, list)


		//INTERNAL PROPERTIES
		new_node.id = id_counter++

		new_node.x_list[agg_gen.gen_id] = agg_fn(list.map(function(d){
			return d.x_list[self.gen_id]
		}))
		new_node.y_list[agg_gen.gen_id] = agg_fn(list.map(function(d){
			return d.y_list[self.gen_id]
		}))
		new_node.r_list[agg_gen.gen_id] = agg_fn(list.map(function(d){
			return d.r_list[self.gen_id]
		}))
		new_node.rho_list[agg_gen.gen_id] = agg_fn(list.map(function(d){
			return d.rho_list[self.gen_id]
		}))
		new_node.theta_list[agg_gen.gen_id] = agg_fn(list.map(function(d){
			return d.theta_list[self.gen_id]
		}))

		new_node.hover_list[agg_gen.gen_id] = false
		new_node.fill_list[agg_gen.gen_id] = list[0].fill_list[this.gen_id]


		//EXTERNAL PROPERTIES
		var node_attrs = this.canvas.glo.node_attr()
		for(var prop in node_attrs){
			if(node_attrs[prop]=="continuous"){
				new_node[prop] = agg_fn(list.map(function(d){
					return d[prop]
				}))
			}else{
				new_node[prop] = list[0][prop]
			}
		}

		//AGGREGATE PROPERTY (ALWAYS SUM)
		new_node.count = d3.sum(list.map(function(d){
			return d.count
		}))

	}

	this.node_g.style("display", "none")
	this.canvas.active_node_generation(agg_gen)
	agg_gen.init_svg().init_draw().update()

	return agg_gen

}


GLO.NodeGeneration.prototype.select = function(str){
	return this.node_g.select(str)
}

GLO.NodeGeneration.prototype.selectAll = function(str){
	return this.node_g.selectAll(str)
}

GLO.NodeGeneration.prototype.update = function(){
	var self = this

	if(this.is_aggregated){
		for(var [n,list] of this.aggregate_node_map){
			for(var d in list){
				d = list[d]
				d.x_list[self.aggregate_source_generation.gen_id] = n.x_list[self.gen_id]
				d.y_list[self.aggregate_source_generation.gen_id] = n.y_list[self.gen_id]
				d.r_list[self.aggregate_source_generation.gen_id] = n.r_list[self.gen_id]
				d.fill_list[self.aggregate_source_generation.gen_id] = n.fill_list[self.gen_id]
				d.hover_list[self.aggregate_source_generation.gen_id] = n.hover_list[self.gen_id]
			}
		}
		this.aggregate_source_generation.update()
	}

	this.node_glyphs.transition()
		.attr("cx", function(d){ return d.x_list[self.gen_id]; })
		.attr("cy", function(d){ return d.y_list[self.gen_id]; })
		.attr("r", function(d){ return d.r_list[self.gen_id]; })
		.attr("fill", function(d){ return d.fill_list[self.gen_id]; })

	for(let edge_gen of this.edge_generation_listeners){
		edge_gen.update()
	}

	return this
}


GLO.NodeGeneration.prototype.add_listener = function(edge_gen){
	this.edge_generation_listeners.add( edge_gen )
}

GLO.NodeGeneration.prototype.remove_listener = function(edge_gen){
	this.edge_generation_listeners.delete( edge_gen )
}


GLO.NodeGeneration.prototype.init_svg = function(){
	this.node_g = this.canvas.chart.append("g")
		.classed("nodeg",true)

	this.node_glyphs = this.node_g.selectAll(".node")
		.data(this.nodes, function(d){return d.id})
	this.node_glyphs.enter().append("circle")
		.classed("node",true)
		.classed("gen-"+this.gen_id,true)
		.attr("nodeid", function(d){return d.id})

	return this
}



GLO.NodeGeneration.prototype.init_props = function(){
	var self = this

	this.node_glyphs
		.each(function(d){
			d.r_list[self.gen_id] = self.default_r
			d.x_list[self.gen_id] = self.canvas.center()
			d.y_list[self.gen_id] = self.canvas.middle()
			d.rho_list[self.gen_id] = 0
			d.theta_list[self.gen_id] = Math.PI/2
			d.fill_list[self.gen_id] = self.default_fill
			d.hover_list[self.gen_id] = false
		})


	return this
}

GLO.NodeGeneration.prototype.init_draw = function(){
	var self = this
	
	
	this.node_glyphs
		.attr("r",function(d){
			return d.r_list[self.gen_id]
		})
		.attr("cx", function(d) {
			return d.x_list[self.gen_id];
		})
		.attr("cy", function(d) {
			return d.y_list[self.gen_id];
		})
		.attr("fill", function(d){
			return d.fill_list[self.gen_id]
		})
		.on('mouseover', function(d){
			d.hover_list[self.gen_id] = true
			self.update()
		})
		.on('mouseout', function(d){
			d.hover_list[self.gen_id] = false
			self.update()
		})

	return this
}

GLO.NodeGeneration.prototype.size_by_constant = function(constant){
	var self = this

	this.nodes.forEach(function(d){
		d.r_list[self.gen_id] = constant
	})

	this.update()
	return this
}

GLO.NodeGeneration.prototype.size_by = function(attr){
	var self = this
	var type = this.canvas.glo.node_attr()[attr]
	if(type=="continuous"){
		this.size_by_continuous(attr)
	}else if(type=="discrete"){
		this.size_by_discrete(attr)
	}else{
		throw "Unrecognized Type Error"
	}

	return this
}

GLO.NodeGeneration.prototype.size_by_discrete = function(attr){
	var self = this

	var scale = d3.scale.ordinal()
		.domain(this.nodes.map(function(d){
			return d[attr]
		}).sort(function(a,b){
			var val
			if(_.isNumber(a)){
				val = a-b
			}else{
				val = a.localeCompare(b)
			}
			return val
		}))

	this.r_scale = scale
		.rangePoints([this.min_r,this.max_r])
	
	this.nodes.forEach(function(d){
		d.r_list[self.gen_id] = scale(d[attr])
	})

	this.update()
	return this
}


GLO.NodeGeneration.prototype.size_by_continuous = function(attr){
	var self = this

	var extent = d3.extent(this.nodes.map(function(d){
		return d[attr]
	}))


	var scale = d3.scale.linear()
		.domain(extent)
		.range([this.min_r,this.max_r])
	

	this.nodes.forEach(function(d){
		d.r_list[self.gen_id] = scale(d[attr])
	})

	this.r_scale = scale

	this.update()
	return this

}


GLO.NodeGeneration.prototype.color_by_constant = function(constant){
	var self = this

	this.nodes.forEach(function(d){
		d.fill_list[self.gen_id] = constant
	})

	this.update()
	return this
}





GLO.NodeGeneration.prototype.color_by = function(attr){
	var self = this
	var type = this.canvas.glo.node_attr()[attr]
	if(type=="color"){
		this.color_by_color_attr(attr)
	}else if(type=="continuous"){
		this.color_by_continuous(attr)
	}else if(type=="discrete"){
		this.color_by_discrete(attr)
	}else{
		throw "Unrecognized Type Error"
	}

	return this
}

GLO.NodeGeneration.prototype.color_by_continuous = function(attr){
	var self = this

	var extent = d3.extent(this.nodes.map(function(d){
		return d[attr]
	}))


	var scale = d3.scale.linear()
	if(extent[0]<=0 && extent[1]>=0){
		scale
			.domain([extent[0], 0, extent[1]])
			.range(["red", "white", "blue"])
	}else if(extent[0]>0){
		scale
			.domain(extent)
			.range(["white", "blue"])
	}else{// externt[0]<0
		scale
			.domain(extent)
			.range(["red", "white"])
	}
	

	this.nodes.forEach(function(d){
		d.fill_list[self.gen_id] = scale(d[attr])
	})

	this.fill_scale = scale

	this.update()
	return this
}

GLO.NodeGeneration.prototype.color_by_discrete = function(attr){
	var self = this

	var scale = d3.scale.category10()

	this.nodes.forEach(function(d){
		d.fill_list[self.gen_id] = scale(d[attr])
	})

	this.fill_scale = scale

	this.update()
	return this
}

GLO.NodeGeneration.prototype.color_by_color_attr = function(attr){
	var self = this

	this.nodes.forEach(function(d){
		d.fill_list[self.gen_id] = d[attr]
	})

	this.update()
	return this
}



GLO.NodeGeneration.prototype.apply_force_directed = function(edges){
	var self = this
	var force = cola.d3adaptor()
		.linkDistance(48)
		.size([self.canvas.canvas_width(),self.canvas.canvas_height()])
		.nodes(self.nodes)
		.links(edges)
		.on('tick', function(){
			self.nodes.forEach(function(d){
				d.x_list[self.gen_id] = d.x
				d.y_list[self.gen_id] = d.y
			})
			self.update()
		})
		.start()

	var xscale = d3.scale.linear()
		.range([this.canvas.left(),this.canvas.right()])
		.domain([0,1])

	this.x_scale = xscale

	var yscale = d3.scale.linear()
		.range([this.canvas.bottom(),this.canvas.top()])
		.domain([0,1])

	this.y_scale = yscale

	if(this.canvas.x_axis_gen()==this){
		this.canvas.x_axis_gen(this)
	}
	if(this.canvas.y_axis_gen()==this){
		this.canvas.y_axis_gen(this)
	}

	return this
}


GLO.NodeGeneration.prototype.rho_shift = function(d,new_rho){
	var self = this
	var old_x = d.x_list[self.gen_id]
	var old_y = d.y_list[self.gen_id]
	var old_x_normed = old_x-self.canvas.center()
	var old_y_normed = old_y-self.canvas.middle()
	var polars = cartesian2polar(old_x_normed, old_y_normed)
	polars.rho = new_rho
	var new_coords = polar2cartesian(polars.rho, polars.theta)
	new_coords.x += self.canvas.center()
	new_coords.y += self.canvas.middle()
	return new_coords
}

GLO.NodeGeneration.prototype.theta_shift = function(d,new_theta){
	var self = this
	var old_x = d.x_list[self.gen_id]
	var old_y = d.y_list[self.gen_id]
	var old_x_normed = old_x-self.canvas.center()
	var old_y_normed = old_y-self.canvas.middle()
	var polars = cartesian2polar(old_x_normed, old_y_normed)
	polars.theta = new_theta
	var new_coords = polar2cartesian(polars.rho, polars.theta)
	new_coords.x += self.canvas.center()
	new_coords.y += self.canvas.middle()
	return new_coords
}

GLO.NodeGeneration.prototype.position_on = function(axis,val){
	if(_.isNumber(val)){
		this.position_by_constant(axis,val)
	}else{
		this.position_by_attr(axis,val)
	}
	return this
}

GLO.NodeGeneration.prototype.position_by_attr = function(axis,attr){
	var type = this.canvas.glo.node_attr()[attr]
	if(type == "continuous"){
		this.position_by_continuous(axis,attr)
	}else if(type == "discrete" || type=="color"){
		this.position_by_discrete(axis,attr)
	}else{
		throw "Undefined Attribute Error"
	}

	return this
}

GLO.NodeGeneration.prototype.position_by_continuous = function(axis,attr){
	var self = this

	var scale = d3.scale.linear()
		.domain(d3.extent(this.nodes.map(function(d){
			return d[attr]
		})))


	if(axis=="x"){
		this.x_scale = scale
			.range([this.canvas.left(),this.canvas.right()])
		
		this.nodes.forEach(function(d){
			d.x_list[self.gen_id] = scale(d[attr])
		})
	}
	if(axis=="y"){
		this.y_scale = scale
			.range([this.canvas.bottom(),this.canvas.top()])
		
		this.nodes.forEach(function(d){
			d.y_list[self.gen_id] = scale(d[attr])
		})
	}
	if(axis=="rho"){
		this.rho_scale = scale
			.range([1,Math.min(this.canvas.canvas_width(),this.canvas.canvas_height())/2])
	
		this.nodes.forEach(function(d){
			d.rho_list[self.gen_id] = scale(d[attr])
			var new_coords = self.rho_shift(d, d.rho_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}
	if(axis=="theta"){
		this.theta_scale = scale
			.range([3*Math.PI/2,7*Math.PI/2])

		this.nodes.forEach(function(d){
			d.theta_list[self.gen_id] = scale(d[attr])
			var new_coords = self.theta_shift(d, d.theta_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}

	if(axis=="x"){
		this.canvas.x_axis_gen(this)
	}
	if(axis=="y"){
		this.canvas.y_axis_gen(this)
	}

	this.update()
	return this
}

GLO.NodeGeneration.prototype.position_by_discrete = function(axis,attr){
	var self = this

	var scale = d3.scale.ordinal()
		.domain(this.nodes.map(function(d){
			return d[attr]
		}).sort(function(a,b){
			var val
			if(_.isNumber(a)){
				val = a-b
			}else{
				val = a.localeCompare(b)
			}
			return val
		}))

	if(axis=="x"){
		this.x_scale = scale
			.rangePoints([this.canvas.left(),this.canvas.right()],this.discrete_range_padding)
		
		this.nodes.forEach(function(d){
			d.x_list[self.gen_id] = scale(d[attr])
		})
	}
	if(axis=="y"){
		this.y_scale = scale
			.rangePoints([this.canvas.bottom(),this.canvas.top()],this.discrete_range_padding)
		
		this.nodes.forEach(function(d){
			d.y_list[self.gen_id] = scale(d[attr])
		})
	}
	if(axis=="rho"){
		this.rho_scale = scale
			.rangePoints([1,Math.min(this.canvas.canvas_width(),this.canvas.canvas_height())/2],this.discrete_range_padding)
	
		this.nodes.forEach(function(d){
			d.rho_list[self.gen_id] = scale(d[attr])
			var new_coords = self.rho_shift(d, d.rho_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}
	if(axis=="theta"){
		this.theta_scale = scale
			.rangeBands([3*Math.PI/2,7*Math.PI/2],this.discrete_range_padding)

		this.nodes.forEach(function(d){
			d.theta_list[self.gen_id] = scale(d[attr])
			var new_coords = self.theta_shift(d, d.theta_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}

	if(axis=="x"){
		this.canvas.x_axis_gen(this)
	}
	if(axis=="y"){
		this.canvas.y_axis_gen(this)
	}

	this.update()
	return this
}



GLO.NodeGeneration.prototype.position_by_constant = function(axis,constant){
	var self = this

	var scale = d3.scale.linear()

	if(axis=="x"){
		this.x_scale = scale
		this.nodes.forEach(function(d){
			d.x_list[self.gen_id] = constant
		})
	}

	if(axis=="y"){
		this.y_scale = scale
		this.nodes.forEach(function(d){
			d.y_list[self.gen_id] = constant
		})
	}

	if(axis=="rho"){
		this.rho_scale = scale
		this.nodes.forEach(function(d){
			d.rho_list[self.gen_id] = constant
			var new_coords = self.rho_shift(d, d.rho_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}

	if(axis=="theta"){
		this.theta_scale = scale

		this.nodes.forEach(function(d){
			d.theta_list[self.gen_id] = constant*(Math.PI/180)
			var new_coords = self.theta_shift(d, d.theta_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}

	if(axis=="x"){
		this.canvas.x_axis_gen(this)
	}
	if(axis=="y"){
		this.canvas.y_axis_gen(this)
	}

	this.update()
	return this
}


GLO.NodeGeneration.prototype.distribute = function(axis,by_prop){
	var self = this


	if(typeof by_prop === "undefined"){
		by_prop = "id"
	}

	self.nodes.sort(function(a,b){
		var val
		if(_.isNumber(a[by_prop])){
			val = a[by_prop]-b[by_prop]
		}else{
			val = a[by_prop].localeCompare(b[by_prop])
		}
		if (val==0){
			return a.id-b.id
		}
		return val
	}).forEach(function(d,i){
		d.index = i
	})

	var scale = d3.scale.ordinal()
		.domain(_.range(self.nodes.length))

	if(axis=="x"){
		this.x_scale = scale
			.rangePoints([this.canvas.left(),this.canvas.right()],this.discrete_range_padding)
		
		this.nodes.forEach(function(d){
			d.x_list[self.gen_id] = scale(d.index)
		})
	}
	if(axis=="y"){
		this.y_scale = scale
			.rangePoints([this.canvas.bottom(),this.canvas.top()],this.discrete_range_padding)
		
		this.nodes.forEach(function(d){
			d.y_list[self.gen_id] = scale(d.index)
		})
	}
	if(axis=="rho"){
		this.rho_scale = scale
			.rangePoints([1,Math.min(this.canvas.canvas_width(),this.canvas.canvas_height())/2],this.discrete_range_padding)
	
		this.nodes.forEach(function(d){
			d.rho_list[self.gen_id] = scale(d.index)
			var new_coords = self.rho_shift(d, d.rho_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}
	if(axis=="theta"){
		this.theta_scale = scale
			.rangeBands([3*Math.PI/2,7*Math.PI/2],this.discrete_range_padding)

		this.nodes.forEach(function(d){
			d.theta_list[self.gen_id] = scale(d.index)
			var new_coords = self.theta_shift(d, d.theta_list[self.gen_id])
			d.x_list[self.gen_id] = new_coords.x
			d.y_list[self.gen_id] = new_coords.y
		})
	}

	if(axis=="x"){
		this.canvas.x_axis_gen(this)
	}
	if(axis=="y"){
		this.canvas.y_axis_gen(this)
	}

	this.update()
	return this
}

/**
	Returns a map of discrete_val --> [nodes]
*/
GLO.NodeGeneration.prototype._group_by = function(discrete){
	var self = this

	var groups = new Map()

	this.nodes.forEach(function(d){
		if(!groups[d[discrete]]){
			groups[d[discrete]] = []
		}
		groups[d[discrete]].push(d)
	})

	return groups
}


GLO.NodeGeneration.prototype.distribute_on_within = function(axis,within_prop,by_prop){
	var self = this

	if(typeof by_prop === "undefined"){
		by_prop = "id"
	}

	var groups = this._group_by(within_prop) //within_prop-->[nodes] map

	for(var dis in groups){
		var nodes = groups[dis]
		nodes.sort(function(a,b){
			var val
			if(_.isNumber(a[by_prop])){
				val = a[by_prop]-b[by_prop]
			}else{
				val = a[by_prop].localeCompare(b[by_prop])
			}
			if (val==0){
				return a.id-b.id
			}
			return val
		}).forEach(function(d,i){
			d.index = i
		})

		var scale = d3.scale.ordinal()
			.domain(_.range(nodes.length))

		if(axis=="x"){
			scale
				.rangePoints([this.canvas.left(),this.canvas.right()],this.discrete_range_padding)
			
			nodes.forEach(function(d){
				d.x_list[self.gen_id] = scale(d.index)
			})
		}
		if(axis=="y"){
			scale
				.rangePoints([this.canvas.bottom(),this.canvas.top()],this.discrete_range_padding)
			
			nodes.forEach(function(d){
				d.y_list[self.gen_id] = scale(d.index)
			})
		}
		if(axis=="rho"){
			rho_scale = scale
				.rangePoints([1,Math.min(this.canvas.canvas_width(),this.canvas.canvas_height())/2],this.discrete_range_padding)
		
			this.nodes.forEach(function(d){
				d.rho_list[self.gen_id] = scale(d.index)
				var new_coords = self.rho_shift(d, d.rho_list[self.gen_id])
				d.x_list[self.gen_id] = new_coords.x
				d.y_list[self.gen_id] = new_coords.y
			})
		}
		if(axis=="theta"){
			theta_scale = scale
				.rangeBands([3*Math.PI/2,7*Math.PI/2],this.discrete_range_padding)

			nodes.forEach(function(d){
				d.theta_list[self.gen_id] = scale(d.index)
				var new_coords = self.theta_shift(d, d.theta_list[self.gen_id])
				d.x_list[self.gen_id] = new_coords.x
				d.y_list[self.gen_id] = new_coords.y
			})
		}

	}//end for(var dis in groups)


	//Clear scales if necessary
	if(axis=="x"){
		var xscale = d3.scale.linear()
			.range([this.canvas.left(),this.canvas.right()])
			.domain([0,1])

		this.x_scale = xscale
		if(this.canvas.x_axis_gen()==this){
			this.canvas.x_axis_gen(this)
		}
	}
	
	if(axis=="y"){
		var yscale = d3.scale.linear()
			.range([this.canvas.bottom(),this.canvas.top()])
			.domain([0,1])

		this.y_scale = yscale

		
		if(this.canvas.y_axis_gen()==this){
			this.canvas.y_axis_gen(this)
		}
	}

	

	this.update()
	return this

}




GLO.NodeGeneration.prototype.align = function(dir){
	var self = this

	if(dir=="top"){
		this.node_glyphs
			.each(function(d){
				d.y_list[self.gen_id] = self.canvas.top()
			})
	}

	if(dir=="middle"){
		this.node_glyphs
			.each(function(d){
				d.y_list[self.gen_id] = self.canvas.middle()
			})
	}

	if(dir=="bottom"){
		this.node_glyphs
			.each(function(d){
				d.y_list[self.gen_id] = self.canvas.bottom()
			})
	}

	if(dir=="left"){
		this.node_glyphs
			.each(function(d){
				d.x_list[self.gen_id] = self.canvas.left()
			})
	}

	if(dir=="center"){
		this.node_glyphs
			.each(function(d){
				d.x_list[self.gen_id] = self.canvas.center()
			})
	}

	if(dir=="right"){
		this.node_glyphs
			.each(function(d){
				d.x_list[self.gen_id] = self.canvas.right()
			})
	}

	if(dir=="top" || dir=="middle" || dir=="bottom"){
		this.canvas.y_axis_gen(this)
	}
	if(dir=="left" || dir=="center" || dir=="right"){
		this.canvas.x_axis_gen(this)
	}

	this.update()

	return this

}