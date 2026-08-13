import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomSnapshot, ServerMessage, Vote } from './protocol';

// 紛らわしい文字(0/O/1/I/L)を除いたコード用アルファベット。
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const IDENTITY_KEY = 'peer-review-game-online-identity';
const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 10_000;

const randomCode = (length = 4): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
};

// 本番は同一オリジン、開発は vite が /api を wrangler にプロキシする。
const wsBase = (): string => {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/room`;
};

// 復帰情報。token は本人だけが持つ秘密で、これがないとゲーム中の再入室はできない。
//
// 保存先は localStorage ではなく sessionStorage。localStorage はオリジン単位で全タブ共有のため、
// 同じ端末で2つ目のタブを開くと相手の席を復元して奪い合いが起きる。sessionStorage はタブ単位で、
// かつリロードやタブ復元では保持されるので、狙いどおり「同じ席に戻る」だけが実現できる。
type Identity = { code: string; playerId: string; token: string };

const loadIdentity = (): Identity | null => {
  try {
    const raw = sessionStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Identity>;
    return value.code && value.playerId && value.token
      ? { code: value.code, playerId: value.playerId, token: value.token }
      : null;
  } catch {
    return null;
  }
};

const saveIdentity = (identity: Identity | null): void => {
  try {
    if (identity) sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    else sessionStorage.removeItem(IDENTITY_KEY);
  } catch {
    // ストレージが使えなくても、その接続が続く限りは遊べる。
  }
};

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

export type UseRoom = {
  status: ConnStatus;
  room: RoomSnapshot | null;
  playerId: string | null;
  code: string | null;
  error: string | null;
  /** 保存済みの復帰情報で自動復帰を試みている最中か（初回描画のちらつき防止に使う） */
  restoring: boolean;
  create: (name: string) => void;
  join: (code: string, name: string) => void;
  leave: () => void;
  send: (msg: ClientMessage) => void;
  vote: (vote: Vote) => void;
};

export const useRoom = (): UseRoom => {
  const wsRef = useRef<WebSocket | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pingRef = useRef<number | null>(null);
  const intentionalRef = useRef(false);

  const [status, setStatus] = useState<ConnStatus>('idle');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(() => loadIdentity() !== null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (pingRef.current !== null) window.clearInterval(pingRef.current);
    timerRef.current = null;
    pingRef.current = null;
  }, []);

  // 再接続時に同じ関数を使い回すため、接続処理は ref 経由で自己参照する。
  const openSocketRef = useRef<(url: string) => void>(() => undefined);

  const scheduleReconnect = useCallback(() => {
    const identity = identityRef.current;
    if (!identity || intentionalRef.current) return;
    setStatus('reconnecting');
    const delay = Math.min(1000 * 2 ** retryRef.current, MAX_BACKOFF_MS);
    retryRef.current += 1;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const params = new URLSearchParams({ rejoin: identity.playerId, token: identity.token });
      openSocketRef.current(`${wsBase()}/${identity.code}?${params.toString()}`);
    }, delay);
  }, []);

  const openSocket = useCallback(
    (url: string) => {
      clearTimers();
      wsRef.current?.close();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('open');
        setError(null);
        pingRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' } satisfies ClientMessage));
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (msg.t === 'joined') {
          identityRef.current = { code: msg.code, playerId: msg.playerId, token: msg.token };
          saveIdentity(identityRef.current);
          setPlayerId(msg.playerId);
          setCode(msg.code);
          setRestoring(false);
        } else if (msg.t === 'state') {
          setRoom(msg.room);
          setRestoring(false);
        } else if (msg.t === 'error') {
          setError(msg.message);
          if (msg.fatal) {
            // 復帰不能。保存情報を捨てて入口からやり直す。
            intentionalRef.current = true;
            identityRef.current = null;
            saveIdentity(null);
            setRoom(null);
            setPlayerId(null);
          }
          setStatus('error');
          setRestoring(false);
        }
      };

      ws.onclose = () => {
        if (pingRef.current !== null) window.clearInterval(pingRef.current);
        pingRef.current = null;
        if (intentionalRef.current || !identityRef.current) {
          setStatus((prev) => (prev === 'error' ? prev : 'closed'));
          setRestoring(false);
          return;
        }
        scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose が続けて呼ばれるので、ここでは状態を変えない。
      };
    },
    [clearTimers, scheduleReconnect],
  );

  openSocketRef.current = openSocket;

  const connect = useCallback(
    (theCode: string, name: string, create: boolean) => {
      intentionalRef.current = false;
      retryRef.current = 0;
      identityRef.current = null;
      saveIdentity(null);
      setError(null);
      setRoom(null);
      setPlayerId(null);
      setCode(theCode);
      setStatus('connecting');

      const params = new URLSearchParams({ name });
      if (create) params.set('create', '1');
      openSocket(`${wsBase()}/${theCode}?${params.toString()}`);
    },
    [openSocket],
  );

  const create = useCallback((name: string) => connect(randomCode(), name, true), [connect]);
  const join = useCallback((c: string, name: string) => connect(c.toUpperCase(), name, false), [connect]);

  const leave = useCallback(() => {
    intentionalRef.current = true;
    identityRef.current = null;
    saveIdentity(null);
    clearTimers();
    // 通信断ではなく本人の退出だと伝えてから閉じる（サーバは席を明け渡す）。
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'leave' } satisfies ClientMessage));
    ws?.close();
    wsRef.current = null;
    setStatus('idle');
    setRoom(null);
    setPlayerId(null);
    setCode(null);
    setError(null);
    setRestoring(false);
  }, [clearTimers]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const vote = useCallback((v: Vote) => send({ t: 'vote', vote: v }), [send]);

  // 初回マウント時、保存済みの復帰情報があれば自動で復帰を試みる。
  // 端末のスリープやブラウザによるタブ破棄でページごと再読み込みされても席に戻れる。
  useEffect(() => {
    const identity = loadIdentity();
    if (!identity) return;
    identityRef.current = identity;
    setCode(identity.code);
    setPlayerId(identity.playerId);
    setStatus('connecting');
    const params = new URLSearchParams({ rejoin: identity.playerId, token: identity.token });
    openSocket(`${wsBase()}/${identity.code}?${params.toString()}`);
    // 初回のみ実行する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // スリープ復帰・タブ再表示のときは、バックオフを待たず即座に繋ぎ直す。
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      if (intentionalRef.current || !identityRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      retryRef.current = 0;
      scheduleReconnect();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [scheduleReconnect]);

  useEffect(
    () => () => {
      intentionalRef.current = true;
      clearTimers();
      wsRef.current?.close();
    },
    [clearTimers],
  );

  return { status, room, playerId, code, error, restoring, create, join, leave, send, vote };
};
