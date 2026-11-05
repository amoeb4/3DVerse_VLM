# server_grpc.py
import grpc
from concurrent import futures
from opcua import Client
import cnc_pb2
import cnc_pb2_grpc
import time

OPC_UA_ENDPOINT = "opc.tcp://192.168.214.252:50051"
TIMEOUT = 5.0  # secondes

class CNCServiceServicer(cnc_pb2_grpc.CNCServiceServicer):

    def ReadVariable(self, request, context):
#       initial
#        client.set_security_string("None")
#        try:dd
#            client.connect(timeout=TIMEOUT)
#            node = client.get_node(request.node_id)
#            value = node.get_value()
#            print(f"[READ] {request.node_id} = {value}")
#        except Exception as e:
#            print(f"[ERROR] ReadVariable: {e}")
#            value = "ERROR"
#        finally:
#         client.disconnect()
#        return cnc_pb2.ReadResponse(value=str(value))
        return cnc_pb2.ReadResponse(value=str("Hello"))

    def WriteVariable(self, request, context):
        client = Client(OPC_UA_ENDPOINT)
        client.set_security_string("None")
        try:
            client.connect(timeout=TIMEOUT)
            node = client.get_node(request.node_id)
            node.set_value(request.value)
            print(f"[WRITE] {request.node_id} = {request.value}")
            success = True
        except Exception as e:
            print(f"[ERROR] WriteVariable: {e}")
            success = False
        finally:
            client.disconnect()
        return cnc_pb2.WriteResponse(success=success)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    cnc_pb2_grpc.add_CNCServiceServicer_to_server(CNCServiceServicer(), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    print("gRPC server started on port 50051")
    try:
        while True:
            time.sleep(60*60*24)
    except KeyboardInterrupt:
        print("Stopping server...")
        server.stop(0)

if __name__ == "__main__":
    serve()

