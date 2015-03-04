import web
import simplejson as json
import ast
import csv
import os.path
import MySQLdb
from collections import defaultdict

urls = (
	'/', 'gui',
	'/q/(\d+)', 'data_request',
	'/(.*)', 'dataset',
)

render = web.template.render('templates')


class gui:
	def GET(self):
		d = {"dataset": "LesMis", "request_id": ""}
		return render.gui(d)

class dataset:
	def GET(self, name):
		d = {}
		d["dataset"] = name
		d["request_id"] = ""
		return render.gui(d)

class data_request:
	def GET(self, id):
		id = int(id)
		d = {}

		database = ""
		q = ""
		if id == 1:
			database = "prodigalobservation"
			q = "SELECT source, target, weight  FROM   (  SELECT fromUser AS source, touser AS target, COUNT(*) AS weight  FROM imLink  WHERE eventdate>='2014-05-05' AND eventdate<'2014-05-19'   AND FLOOR(fromuser/1000)%10=1 AND FLOOR(touser/1000)%10=1  GROUP BY fromuser, touser  ) e   NATURAL JOIN  (	SELECT fromuser AS source  	FROM imLink   	WHERE eventdate>='2014-05-05' AND eventdate<'2014-05-19'   	AND FLOOR(fromuser/1000)%10=1 AND FLOOR(touser/1000)%10=1  	GROUP BY fromuser  	HAVING COUNT(DISTINCT touser) >= 3  ) u  "
		elif id == 2:
			database = "prodigalresult"
			q = "select fromImID, toImID, weight FROM imGraph WHERE (toImID = 9000 or fromImID = 9000) and eventDate between '2014-05-01' and '2014-05-31';"
		elif id == 3:
			database = "prodigalresult"
			q = "select fromImID as source, toImID as target, weight FROM imGraph WHERE (toImID = 9000 or fromImID = 9000) and eventDate between '2014-05-01' and '2014-05-07' UNION SELECT y.source, y.target, y.weight FROM (select fromImID as source, toImID as target, weight FROM imGraph WHERE (toImID = 9000 or fromImID = 9000) and eventDate between '2014-05-01' and '2014-05-07') x join (select fromImID as source, toImID as target, weight FROM imGraph WHERE eventDate between '2014-05-01' and '2014-05-07') y on x.target=y.source "
		elif id == 4:
			database = "prodigalobservation"
			q = "SELECT userID, printerID, count(*) from printerEvent where eventDate between '2014-05-08 00:00:00' and '2014-05-08 12:00:00' and printerid > 0 group by userID, printerID"
		elif id == 5:
			database = "prodigalresult"
			q = "select fromImID as source, toImID as target, weight FROM imGraph WHERE (toImID = 9000 or fromImID = 9000) and eventDate between '2014-05-01' and '2014-05-05' UNION SELECT y.source, y.target, y.weight FROM (select fromImID as source, toImID as target, weight FROM imGraph WHERE (toImID = 9000 or fromImID = 9000) and eventDate between '2014-05-01' and '2014-05-05') x join (select fromImID as source, toImID as target, weight FROM imGraph WHERE eventDate between '2014-05-01' and '2014-05-05') y on x.target=y.source"
				
		if not os.path.isfile("./static/data/dynamic/nodes"+str(id)+".csv"): 
			self.generate_graph_files(database, q, id)
		
		d["dataset"] = "dynamic"
		d["request_id"] = str(id)
		return render.gui(d)

	def generate_graph_files(self, database, q, id):
		print database
		db = MySQLdb.connect(host="prodigal5", user="prodigal", passwd="prodigal", port=3307, db=database)
		cur = db.cursor() 
		cur.execute(q)

		edges = cur.fetchall()
		
		degree = defaultdict(int)
		for e in edges:
			degree[e[0]] += 1
			degree[e[1]] += 1
		
		nodes_set = set()
		for e in edges:
			nodes_set.add(e[0])
			nodes_set.add(e[1])
		vno = {}
		no = 0
		for v in nodes_set:
			vno[v] = no
			no += 1
		
		with open("./static/data/dynamic/nodes"+str(id)+".csv", "wb") as f:
			writer = csv.writer(f, delimiter=',')
			writer.writerow( ["id", "label", "modularity_class", "degree"] )
			writer.writerows([[vno[v], v, 0 if id!=4 or int(v)%10==0 else 1, degree[v]] for v in nodes_set])
		with open("./static/data/dynamic/edges"+str(id)+".csv", "wb") as f:
			writer = csv.writer(f, delimiter=',')
			writer.writerow( ["source", "target", "type", "id", "label", "weight"] )
			if id==5:
				writer.writerows([[vno[edges[i][0]], vno[edges[i][1]], "Undirected", i, "", 5] if vno[edges[i][0]]>vno[edges[i][1]] else [vno[edges[i][1]], vno[edges[i][0]], "Undirected", i, "", 5] for i in range(len(edges))])
			else:
				writer.writerows([[vno[edges[i][0]], vno[edges[i][1]], "Directed", i, "", edges[i][2]] for i in range(len(edges))])
	
		
class data_request2:
	def POST(self, s, t):
		m = model.Database(s)
		data = web.data()
		data = ast.literal_eval(data)
		d = m.get_table_instances(t, data)
		return json.dumps(d);


if __name__ == "__main__":
	app = web.application(urls, globals())
	app.internalerror = web.debugerror
	app.run()