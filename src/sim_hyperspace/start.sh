pip install -r requirements.txt
python robot_server.py --trace DAVID_POS_ROBOT_TUBE.xml
python robot_client.py play --skip-idle
python robot_client.py watch