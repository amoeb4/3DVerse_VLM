import grpc
import gRPCCom_pb2
import gRPCCom_pb2_grpc


class CLMClient:
    """
    Close Loop Monitoring Client class Module
    """
    def __init__(self, host="192.168.214.252", port=50051):
        """
        Constructor of the CLMClient class
        :param host: Host IP address or hostname (default: '127.0.0.1')
        :param port: Host port number (default: 50051)
        """
        self.__channel = grpc.insecure_channel(f"{host}:{port}")
        self.__stub = gRPCCom_pb2_grpc.CLMServiceStub(self.__channel)

    def is_connected(self):
        """
        Check if the client is connected to the server
        :return: True if connected, False otherwise
        """
        try:
            request = gRPCCom_pb2.IsConnectedRequest()
            response = self.__stub.IsConnected(request)
        except grpc._channel._InactiveRpcError as _:
            return False
        return response.status

    def readHeader(self):
        """
        Read the header from the server
        :return: Dictionary of header values or None if the connection is lost
        """
        try:
            request = gRPCCom_pb2.ReadRequest()
            response = self.__stub.ReadHeader(request)
        except grpc._channel._InactiveRpcError as _:
            return None
        return response.values

    def readData(self):
        """
        Read the values from the server
        :return: Dictionary of values or None if the connection is lost
        """
        try:
            request = gRPCCom_pb2.ReadRequest()
            response = self.__stub.ReadData(request)
        except grpc._channel._InactiveRpcError as _:
            return None
        return response.values
        
    def write(self, values_dict):
        """
        Write the values to the server
        :param values_dict: Dictionary of values to write
        :return: True if the values are written, False otherwise
        """
        values = {}
        for key, value in values_dict.items():
            if isinstance(value, int):
                values[key] = gRPCCom_pb2.DataValue(int_value=value)
            elif isinstance(value, float):
                values[key] = gRPCCom_pb2.DataValue(float_value=value)
            else:
                raise ValueError("Unsupported value type")

        try:
            request = gRPCCom_pb2.WriteRequest(values=values)
            response = self.__stub.Write(request)
        except grpc._channel._InactiveRpcError as _:
            return False
        return response.status

    def sendAcquisition(self, acq_values):
        """
        Send acquisition data to the server.
        :param acq_values: List of dicts with keys: 'source_name', 'value_name', and one of ('int_value', 'float_value').
                           Example:
                           [
                               {"source_name": "Sensor1", "value_name": "Temperature", "float_value": 36.7},
                               {"source_name": "Sensor2", "value_name": "Pressure", "int_value": 101}
                           ]
        :return: True if the server accepted the data, False otherwise
        """
        try:
            # Construire la liste de SimpleAcqData
            values = []
            for entry in acq_values:
                if "int_value" in entry:
                    values.append(
                        gRPCCom_pb2.SingleAcqData(
                            source_name=entry["source_name"],
                            value_name=entry["value_name"],
                            int_value=entry["int_value"]
                        )
                    )
                elif "float_value" in entry:
                    values.append(
                        gRPCCom_pb2.SingleAcqData(
                            source_name=entry["source_name"],
                            value_name=entry["value_name"],
                            float_value=entry["float_value"]
                        )
                    )
                else:
                    raise ValueError("Each entry must contain either 'int_value' or 'float_value'")

            # Construire le message AcquisitionData
            request = gRPCCom_pb2.AcquisitionData(values=values)

            # Appeler le service gRPC
            response = self.__stub.SendAcquisition(request)

        except grpc._channel._InactiveRpcError:
            return False

        return response.status

    def readAquisition(self):
        """
        Read the values from the server
        """
        try:
            request = gRPCCom_pb2.ReadRequest()
            response = self.__stub.ReadAcquisition(request)
        except grpc._channel._InactiveRpcError as _:
            return None
        return response.values