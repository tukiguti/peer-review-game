import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomSnapshot, ServerMessage, Vote } from './protocol';

// 紛らわしい文字(0/O/1/I/L)を除いたコード用アルファベット。
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const randomCode = (length = 4): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
};

// 本番は同一オリジン、開発は vite が /api を wrangler(8787) にプロキシする。
const wsBase = (): string => {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/room`;
};

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type UseRoom = {
  status: ConnStatus;
  room: RoomSnapshot | null;
  playerId: string | null;
  code: string | null;
  error: string | null;
  create: (name: string) => void;
  join: (code: string, name: string) => void;
  leave: () => void;
  send: (msg: ClientMessage) => void;
  vote: (vote: Vote) => void;
};

export const useRoom = (): UseRoom => {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnStatus>('idle');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback((theCode: string, name: string, create: boolean) => {
    wsRef.current?.close();
    setError(null);
    setRoom(null);
    setPlayerId(null);
    setCode(theCode);
    setStatus('connecting');

    const params = new URLSearchParams({ name });
    if (create) params.set('create', '1');
    const ws = new WebSocket(`${wsBase()}/${theCode}?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('open');
    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.t === 'joined') {
        setPlayerId(msg.playerId);
        setCode(msg.code);
      } else if (msg.t === 'state') {
        setRoom(msg.room);
      } else if (msg.t === 'error') {
        setError(msg.message);
        setStatus('error');
      }
    };
    ws.onclose = () => setStatus((prev) => (prev === 'error' ? prev : 'closed'));
    ws.onerror = () => setStatus((prev) => (prev === 'error' ? prev : 'error'));
  }, []);

  const create = useCallback((name: string) => connect(randomCode(), name, true), [connect]);
  const join = useCallback((c: string, name: string) => connect(c.toUpperCase(), name, false), [connect]);

  const leave = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('idle');
    setRoom(null);
    setPlayerId(null);
    setCode(null);
    setError(null);
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  const vote = useCallback((v: Vote) => send({ t: 'vote', vote: v }), [send]);

  useEffect(() => () => wsRef.current?.close(), []);

  return { status, room, playerId, code, error, create, join, leave, send, vote };
};
