#!/usr/bin/env python3
"""Client de test pour robot_server.py.

    python robot_client.py info
    python robot_client.py play --speed 2 --skip-idle
    python robot_client.py watch --rate 5
    python robot_client.py pause | stop | state | seek 120 | speed 3
"""
import argparse
import sys
from pathlib import Path

import grpc

sys.path.insert(0, str(Path(__file__).resolve().parent))
import robot_pb2 as pb
import robot_pb2_grpc as rpc


def fmt(s):
    axes = " ".join(f"A{i + 1}={v:9.4f}" for i, v in enumerate(s.axes_deg))
    extra = f"  FAULT: {s.fault}" if s.fault else ""
    return (f"{pb.RunState.Name(s.run_state)[10:]:<8} t={s.time_s:8.2f}/{s.duration_s:.0f}s "
            f"x{s.speed:g}  {axes}{extra}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--addr", default="127.0.0.1:50051")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("info"); sub.add_parser("state"); sub.add_parser("pause"); sub.add_parser("stop")
    p = sub.add_parser("play")
    p.add_argument("--speed", type=float, default=0.0)
    p.add_argument("--skip-idle", action="store_true")
    p.add_argument("--loop", action="store_true")
    p.add_argument("--from-start", action="store_true")
    p = sub.add_parser("seek"); p.add_argument("time_s", type=float)
    p = sub.add_parser("speed"); p.add_argument("speed", type=float)
    p = sub.add_parser("watch"); p.add_argument("--rate", type=float, default=5.0)
    a = ap.parse_args()

    stub = rpc.RobotControlStub(grpc.insecure_channel(a.addr))
    try:
        if a.cmd == "info":
            i = stub.GetInfo(pb.Empty())
            print(f"{i.source_file}: {i.duration_s:.0f} s, {i.record_count} enregistrements, "
                  f"{i.idle_s:.0f} s immobile")
            for n, lo, hi, sig in zip(i.axis_names, i.min_deg, i.max_deg, i.signal_names):
                print(f"  {n}: [{lo:9.3f} ; {hi:9.3f}] deg   <- {sig}")
        elif a.cmd == "state":
            print(fmt(stub.GetState(pb.Empty())))
        elif a.cmd == "play":
            print(fmt(stub.Play(pb.PlayRequest(speed=a.speed, skip_idle=a.skip_idle,
                                               loop=a.loop, from_start=a.from_start))))
        elif a.cmd == "pause":
            print(fmt(stub.Pause(pb.Empty())))
        elif a.cmd == "stop":
            print(fmt(stub.Stop(pb.Empty())))
        elif a.cmd == "seek":
            print(fmt(stub.Seek(pb.SeekRequest(time_s=a.time_s))))
        elif a.cmd == "speed":
            print(fmt(stub.SetSpeed(pb.SpeedRequest(speed=a.speed))))
        elif a.cmd == "watch":
            for s in stub.StreamState(pb.StreamRequest(rate_hz=a.rate, stop_when_finished=True)):
                print(fmt(s))
    except grpc.RpcError as e:
        sys.exit(f"Erreur gRPC {e.code().name}: {e.details()}")
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
