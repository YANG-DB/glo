var aggregate_nodes = function(prop1,prop2){
    modes.generation+=1
    modes.link_generation+=1
    var aggregates = {}
    for (var node in node_data()){
      node = node_data()[node]
      var p1 = node[prop1]
      var p2 = node[prop2]
      if(!aggregates[p1+","+p2]){
        aggregates[p1+","+p2] = []
      }
      aggregates[p1+","+p2].push(node)
    }
    
    var agg_nodes = []
    var agg_nodes_dict = {}
    var i = 0
    for (var agg in aggregates){
      var id = agg
      agg = aggregates[agg]
      agg_node = {}
      agg_node.id = "agg"+modes.generation+"i"+i
      i++
      agg_node.x_list = {}
      agg_node.y_list = {}
      agg_node.r_list = {}
      agg_node.in_edges = []
      agg_node.out_edges = []
      agg_node.nodes = agg
      agg_node.count = agg.length
      agg_node.degree = agg[0].degree
      agg_node.modularity_class = agg[0].modularity_class
      agg_node.gender = agg[0].gender
      //currently only can size by count
      //we'll need some non-graph-based properties
      // agg_node.x_list[modes.generation] = xscale(agg_node[prop1])
      agg_node.x_list[modes.generation] = d3.mean(agg_node.nodes.map(function(d){return d.x_list[modes.active_generation]}))
      // agg_node.y_list[modes.generation] = yscale(agg_node[prop2])
      agg_node.y_list[modes.generation] = d3.mean(agg_node.nodes.map(function(d){return d.y_list[modes.active_generation]}))
      agg_node.r_list[modes.generation] = agg_node.count*5
      agg_nodes.push(agg_node)
      agg_nodes_dict[id] = agg_node
    }
    
    //Edges Time!
    var edge_aggregates = {}
    for(var edge in graph.edges){
      edge = graph.edges[edge]
      var p1s = edge.source[prop1]
      var p1t = edge.target[prop1]
      var p2s = edge.source[prop2]
      var p2t = edge.target[prop2]
      if(!edge_aggregates[p1s+","+p2s+","+p1t+","+p2t]){
        var ea = edge_aggregates[p1s+","+p2s+","+p1t+","+p2t] = {}
        ea.edge_list = []
        ea.source = agg_nodes_dict[p1s+","+p2s]
        ea.source.out_edges.push(ea)
        ea.target = agg_nodes_dict[p1t+","+p2t]
        ea.target.in_edges.push(ea)
        ea.id = ++i
     
      }
      edge_aggregates[p1s+","+p2s+","+p1t+","+p2t].edge_list.push(edge)
    }
    var edge_aggregates_list = []
    for(var e in edge_aggregates){
      e = edge_aggregates[e]
      e.weight = e.edge_list.reduce(function(prev,cur,i,arr){
        return prev+cur.weight
      },0)
      e.count = e.edge_list.length
      edge_aggregates_list.push(e)
    }




    node_generations[modes.generation] = agg_glyphs = nodeg.selectAll(".node[generation='"+modes.generation+"']")
      .data(agg_nodes, function(d){return d.id})
    .enter().append("circle")
      .classed("node",true)
      .classed("aggregate",true)
      .attr("generation",modes.generation)
      .attr("nodeid", function(d){return d.id})
      .attr("r",0)
      .attr("fill", function(d){ return d3.rgb(color(d.modularity_class)).darker(); })
      .on("mouseover",function(d){
        d3.select(this).attr("fill",function(d){ return color(d.modularity_class); })
      })
      .on("mouseout",function(d){
        d3.select(this).attr("fill", function(d){ return d3.rgb(color(d.modularity_class)).darker(); })
      })

  agg_glyphs.append("title")
      .text(function(d){ return d.label; })

  node_generations[modes.active_generation]
    .transition().duration(transition_duration)
      .attr("r",0)


  agg_links = link_generations[modes.link_generation] = linkg.selectAll(".link[generation='"+modes.link_generation+"']")
        .data(edge_aggregates_list, function(d){return d.id})
  agg_links.enter().append("svg:path")
        .classed("link",true)
        .each(function(d){
          d.startx = function(){ return this.source.x_list[modes.source_generation]; }
          d.starty = function(){ return this.source.y_list[modes.source_generation]; }
          d.endx = function(){ return this.target.x_list[modes.target_generation]; }
          d.endy = function(){ return this.target.y_list[modes.target_generation]; }
          d.visibility = true
        })
        .attr("generation",modes.link_generation)
        .attr("stroke-width", 0)
        .on("mouseover",function(d){
          d3.select('.node[generation="'+modes.source_generation+'"][nodeid="'+d.source.id+'"]').attr("fill", color(d.source.modularity_class) )
          d3.select('.node[generation="'+modes.target_generation+'"][nodeid="'+d.target.id+'"]').attr("fill", color(d.target.modularity_class) )
        })
        .on("mouseout",function(d){
          d3.select('.node[generation="'+modes.source_generation+'"][nodeid="'+d.source.id+'"]').attr("fill", d3.rgb(color(d.source.modularity_class)).darker() )
          d3.select('.node[generation="'+modes.target_generation+'"][nodeid="'+d.target.id+'"]').attr("fill", d3.rgb(color(d.target.modularity_class)).darker() )
        })
        
        

  link_generations[modes.active_link_generation]
    .transition().duration(transition_duration)
      .attr("stroke-width",0)

  agg_generations[modes.generation] = {}
  agg_generations[modes.generation].source_gen = modes.active_generation
  agg_generations[modes.generation].source_link_gen = modes.active_link_generation
  agg_generations[modes.generation].link_gen = modes.link_generation
  modes.active_generation = modes.generation
  modes.source_generation = modes.generation
  modes.target_generation = modes.generation
  modes.active_link_generation = modes.link_generation
  node = agg_glyphs
  link = agg_links



  node
    .attr("cx", function(d) { return d.x_list[modes.active_generation]; })
    .attr("cy", function(d) { return d.y_list[modes.active_generation]; });
  
  node.transition().duration(transition_duration)
    .attr("r",function(d){
      return d.r_list[modes.generation]
    })



  link.transition().duration(transition_duration)
    .attr("stroke-width", function(d) { return Math.sqrt(d.weight); })
    .call(link_function) //instead of update_links to prevent stacked transitions
    .attr("marker-end", function(d) {
          if(d.startx()==d.endx() && d.starty()==d.endy()){
            console.log((d.startx(),d.endx(),d.starty(),d.endy()))
            return null
          }
          return "url(#arrow)";
        })
}

var deaggregate_nodes = function(agg_gen){
  try{
    if(node_generations[agg_gen].data()[0].id.indexOf("agg")!=0){
      // console.log("nope, not aggregate")
      return
    }else{
      // console.log("yep, aggregate")
      modes.active_generation = agg_generations[agg_gen].source_gen
      modes.active_link_generation = agg_generations[agg_gen].source_link_gen
      modes.source_generation = modes.active_generation
      modes.target_generation = modes.active_generation
      node_generations[agg_gen]
        .transition().duration(transition_duration)
          .attr("r",0)
        .remove()
      link_generations[agg_generations[agg_gen].link_gen]
        .transition().duration(transition_duration)
          .attr("stroke-width",0)
        .remove()

      node_generations[modes.active_generation]
        .transition().duration(transition_duration)
          .attr("r",function(d){return d.r_list[modes.active_generation]})

      link_generations[agg_generations[agg_gen].link_gen] = null
      node_generations[agg_gen] = null
      agg_generations[agg_gen] = null

      link_generations[modes.active_link_generation]
        .call(link_function) //instead of update_links to prevent stacked transitions
        .transition().duration(transition_duration)
          .attr("stroke-width", function(d) { return Math.sqrt(d.weight); })
          
      // update_links()
    }
  }catch(err){
    // console.log("nope, not aggregate")
  }
}

var deaggregate_0 = function(){
  deaggregate_nodes(0)
}

var deaggregate_1 = function(){
  deaggregate_nodes(1)
}

var aggregate_nodes_by_gender_and_category = function(){
  aggregate_nodes("gender","modularity_class")
}

var clone_active_set = function(){
  //Stamps a copy of the current position
  //of the nodes.
  modes.generation+=1
  node_generations[modes.generation] = nodeclone = nodeg.selectAll(".node[generation='"+modes.generation+"']")
      .data(node_data(), function(d){return d.id})
    .enter().append("circle")
      .classed("node",true)
      .attr("generation",modes.generation)
      .attr("nodeid", function(d){return d.id})
      .attr("r",function(d){
          d.r_list[modes.generation] = d.r_list[modes.active_generation]
          return d.r_list[modes.generation]
        })
      .attr("fill", function(d){ return d3.rgb(color(d.modularity_class)).darker(); })
      .on("mouseover",function(d){
        d3.select(this).attr("fill",function(d){ return color(d.modularity_class); })
      })
      .on("mouseout",function(d){
        d3.select(this).attr("fill", function(d){ return d3.rgb(color(d.modularity_class)).darker(); })
      })

  nodeclone.append("title")
      .text(function(d){ return d.label; })

  nodeclone
    .each(function(d){ d.x_list[modes.generation] = d.x_list[modes.active_generation]})
    .each(function(d){ d.y_list[modes.generation] = d.y_list[modes.active_generation]})
    


  modes.active_generation = modes.generation
  node = nodeclone

  node
    .attr("cx", function(d) { return d.x_list[modes.active_generation]; })
    .attr("cy", function(d) { return d.y_list[modes.active_generation]; });

}

var remove_generation = function(gen){
  if(gen==0){ return; } //cannot remove primary nodes
  if(gen==modes.active_generation){
    select_generation(0) //select primary nodes
    to_remove = node_generations[gen]
    node_generations[gen] = null
    to_remove.remove()
  }
  if(gen==modes.source_generation){
    modes.source_generation = 0
  }
  if(gen==modes.target_generation){
    modes.target_generation = 0
  }
  update_links()
}

var remove_generation_1 = function(){
  remove_generation(1)
}



//Select Generations
var select_generation = function(gen){
  modes.active_generation = gen
  node = node_generations[modes.active_generation]
}

var select_generation_0 = function(){
  select_generation(0)
}

var select_generation_1 = function(){
  select_generation(1)
}

var select_generation_2 = function(){
  select_generation(2)
}




var evenly_position_on_x = function(){
  xscale = d3.scale.ordinal()
    .domain(node_data().map(function(d){ return d.id; }))
    .rangePoints([0,width])

  node_generations[modes.active_generation].each(function(d){
    d.x_list[modes.active_generation] = xscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cx",function(d){ return d.x_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}

var evenly_position_on_y = function(){
  yscale = d3.scale.ordinal()
    .domain(node_data().map(function(d){ return d.id; }))
    .rangePoints([0,height])

  node_generations[modes.active_generation].each(function(d){
    d.y_list[modes.active_generation] = yscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cy",function(d){ return d.y_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}

var position_y_top = function(){
  yscale = function(d){
    return 0-0.5*ybuffer;
  }

  node_generations[modes.active_generation].each(function(d){
    d.y_list[modes.active_generation] = yscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cy",function(d){ return d.y_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}

var position_y_middle = function(){
  yscale = function(d){
    return height/2;
  }

  node_generations[modes.active_generation].each(function(d){
    d.y_list[modes.active_generation] = yscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cy",function(d){ return d.y_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}

var position_y_bottom = function(){
  yscale = function(d){
    return height+0.5*ybuffer;
  }

  node_generations[modes.active_generation].each(function(d){
    d.y_list[modes.active_generation] = yscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cy",function(d){ return d.y_list[modes.active_generation] })


  update_rolled_up()

  update_links()
}


var position_x_left = function(){
  xscale = function(d){
    return 0-0.5*xbuffer;
  }

  node_generations[modes.active_generation].each(function(d){
    d.x_list[modes.active_generation] = xscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cx",function(d){ return d.x_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}

var position_x_center = function(){
  xscale = function(d){
    return width/2;
  }

  node_generations[modes.active_generation].each(function(d){
    d.x_list[modes.active_generation] = xscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cx",function(d){ return d.x_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}

var position_x_right = function(){
  xscale = function(d){
    return width+0.5*xbuffer;
  }

  node_generations[modes.active_generation].each(function(d){
    d.x_list[modes.active_generation] = xscale(d.id)
  })

  node_generations[modes.active_generation].transition().duration(transition_duration)
    .attr("cx",function(d){ return d.x_list[modes.active_generation] })

  update_rolled_up()

  update_links()
}


