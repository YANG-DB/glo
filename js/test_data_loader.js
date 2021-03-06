

function test_data_loader(){
  // var source = "PivotGraph"
  var source = "LesMis"
  // var source = "TinyToy"


  //Load Data
  d3.csv("data/"+source+"/nodes.csv",function(nodes){
    d3.csv("data/"+source+"/edges.csv",function(edges){
      nodes.forEach(function(d){
        d.id = +d.id
        d.modularity_class = +d.modularity_class
        d.degree = +d.degree
        d.weighted_degree = +d.weighted_degree
        d.eccentricity = +d.eccentricity
        d.closeness_centrality = +d.closeness_centrality
        d.betweenness_centrality = +d.betweenness_centrality
        d.authority = +d.authority
        d.hub = +d.hub
        d.page_rank = +d.page_rank
        d.component_id = +d.component_id
        d.clustering_coefficient = +d.clustering_coefficient
        d.number_of_triangles = +d.number_of_triangles
        d.eigenvector_centrality = +d.eigenvector_centrality
      })
      edges.forEach(function(d){
        d.source = +d.source
        d.target = +d.target
        d.id = +d.id
        d.weight = +d.weight
      })

      
    })
  })
}
