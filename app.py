from flask import Flask, request, jsonify, make_response, redirect
import json
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'MYNOTSOSECRETKEY'
app.config['CORS_HEADERS'] = 'Content-Type'
app.url_map.strict_slashes = False
CORS(app)

items = [
    {'id':0,'type':'cube','color':'blue','location':'shelf'},
    {'id':1,'type':'ball','color':'yellow','location':'box'},
    {'id':2,'type':'ball','color':'red','location':'box'},
    {'id':3,'type':'wrench','color':'grey','location':'conveyor'}
]

scene = {
    'shelf':     [0],
    'table':     [],
    'box':       [1,2],
    'conveyor':  [3],
}

def create_response(data,code=200,origin='*'):
    response = make_response(jsonify(data),code)
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Content-Type'] = 'json'
    response.headers['Vary'] = 'Origin'
    return response

@app.route('/objects/',methods=['GET'])
def get_objects():
    return create_response({'objects':items},200)

@app.route('/objects/<int:object_id>',methods=['GET'])
def get_object(object_id):
    return create_response(items[object_id],200)

@app.route('/locations/',methods=['GET'])
def get_locations():
    return create_response({'locations':scene.keys()},200)

@app.route('/locations/<string:location>/objects/',methods=['GET'])
def get_objects_at_location(location):
    if location not in scene.keys():
        return create_response({'message':'location not found'},404)
    return create_response({'objects':[items[i] for i in scene[location]]},200)

@app.route('/locations/<string:location>/objects/<int:object_id>',methods=['POST'])
def move_object_to_location(location,object_id):
    if location not in scene.keys():
        return create_response({'message':'location not found'},404)
    if object_id > 3:
        return create_response({'message':'object not found'},404)
    for loc, loc_items in scene.items():
        if object_id in loc_items and loc == location:
            item = items[object_id]
            return create_response({'message':'The {0} {1} is already at the {2}.'.format(item['color'],item['type'],location)},200)
        elif object_id in loc_items:
            scene[loc].remove(object_id)
        if loc == location:
            scene[loc].append(object_id)
    item = items[object_id]
    item['location'] = location
    return create_response({'message':'I moved the {0} {1} to the {2}.'.format(item['color'],item['type'],location)},200)


if __name__ == '__main__':
    app.run(debug=True)
