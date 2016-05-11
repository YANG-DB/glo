GLO.NodeGroup = function(nodes, node_gen){
	var self = this
	this.nodes = nodes
	this.gen = node_gen

	var X = this.nodes.map(function(d){return d.x_list[self.gen.gen_id]; })
	var Y = this.nodes.map(function(d){return d.y_list[self.gen.gen_id]; })
	this.coordinates = new GLO.Coordinates(X,Y)
	return this
}


GLO.NodeGroup.prototype.update_coordinates = function(){
	TODO("update_coordinates")
}