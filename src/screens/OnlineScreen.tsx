import { useState } from 'react';
import appStyles from '../App.module.css';
import styles from '../online/online.module.css';
import { useRoom, type UseRoom } from '../online/useRoom';
import type { CardGenre, CardKind } from '../game/types';

type Props = {
  onBack: () => void;
};

const KIND_LABEL: Record<CardKind, string> = {
  field: '分野',
  method: '手法',
  constraint: '制約',
  novelty: '新規性',
};

const GENRE_LABEL: Record<CardGenre, string> = {
  general: '汎用',
  se: 'ソフトウェア工学',
  security: 'セキュリティ',
  fashion: 'ファッション',
};

const PHASE_TITLE: Record<string, string> = {
  lobby: 'ロビー',
  present: '発表',
  voting: '投票',
  reveal: '結果',
  final: '最終結果',
};

export const OnlineScreen = ({ onBack }: Props) => {
  const room = useRoom();
  if (!room.room) {
    return <OnlineEntry room={room} onBack={onBack} />;
  }
  return <OnlineRoom room={room} onBack={onBack} />;
};

const OnlineEntry = ({ room, onBack }: { room: UseRoom; onBack: () => void }) => {
  const paramCode = new URLSearchParams(window.location.search).get('room') ?? '';
  const [name, setName] = useState('');
  const [code, setCode] = useState(paramCode.toUpperCase());
  const connecting = room.status === 'connecting';
  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && !connecting;
  const canJoin = canCreate && code.trim().length >= 3;

  return (
    <section className={appStyles.screen}>
      <div className={appStyles.screenHeader}>
        <div>
          <p className={appStyles.eyebrow}>online</p>
          <h2>オンラインプレイ</h2>
        </div>
      </div>

      <div className={appStyles.panel}>
        <h3>表示名</h3>
        <input
          className={styles.textInput}
          value={name}
          maxLength={20}
          placeholder="みんなに見える名前"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.entryGrid}>
        <div className={appStyles.panel}>
          <h3>部屋を作る</h3>
          <p className={styles.help}>
            あなたが司会（進行役）になります。作成後に表示されるコード／リンクを仲間に共有してください。
          </p>
          <button className={appStyles.primaryButton} type="button" disabled={!canCreate} onClick={() => room.create(trimmedName)}>
            部屋を作る
          </button>
        </div>

        <div className={appStyles.panel}>
          <h3>部屋に参加</h3>
          <input
            className={styles.textInput}
            value={code}
            maxLength={6}
            placeholder="部屋コード（例: KXY7）"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className={appStyles.primaryButton} type="button" disabled={!canJoin} onClick={() => room.join(code.trim(), trimmedName)}>
            参加する
          </button>
        </div>
      </div>

      {room.error && <p className={appStyles.compositionError}>{room.error}</p>}
      {connecting && <p className={styles.help}>接続中…</p>}

      <div className={appStyles.actionBar}>
        <button className={appStyles.secondaryButton} type="button" onClick={onBack}>
          ← 遊び方の選択へ戻る
        </button>
      </div>
    </section>
  );
};

const OnlineRoom = ({ room, onBack }: { room: UseRoom; onBack: () => void }) => {
  const snap = room.room!;
  const me = snap.players.find((p) => p.id === room.playerId);
  const isHost = Boolean(me?.isHost);
  const presenter = snap.players.find((p) => p.id === snap.presenterId) ?? null;
  const iAmPresenter = snap.presenterId === room.playerId;
  const connectedCount = snap.players.filter((p) => p.connected).length;
  const voterTotal = snap.players.filter((p) => p.connected && p.id !== snap.presenterId).length;

  const leave = () => {
    room.leave();
    onBack();
  };

  return (
    <section className={appStyles.screen}>
      <div className={appStyles.screenHeader}>
        <div>
          <p className={appStyles.eyebrow}>online ・ 部屋 {snap.code}</p>
          <h2>
            {PHASE_TITLE[snap.phase]}
            {snap.phase === 'present' && presenter ? `：${presenter.name} さん` : ''}
          </h2>
        </div>
        <button className={appStyles.secondaryButton} type="button" onClick={leave}>
          退出
        </button>
      </div>

      {snap.phase === 'lobby' && <LobbyBody snap={snap} isHost={isHost} connectedCount={connectedCount} room={room} />}

      {snap.phase === 'present' && (
        <div className={styles.turnPanel}>
          <p className={styles.turnLead}>
            {iAmPresenter ? 'あなたの番です。' : `${presenter?.name} さんが発表します。`}
          </p>
          <p className={styles.help}>
            {iAmPresenter
              ? 'このカード構成で、それらしい研究を口頭で発表してください（制約カードの無茶ぶりは無視できません）。'
              : '発表を聞いて、査読の準備をしましょう。'}
          </p>
          <Hand snap={snap} />
          {isHost && (
            <button className={appStyles.primaryButton} type="button" onClick={() => room.send({ t: 'openVoting' })}>
              投票を始める
            </button>
          )}
        </div>
      )}

      {snap.phase === 'voting' && (
        <div className={styles.turnPanel}>
          <Hand snap={snap} />
          <VotingBody snap={snap} room={room} iAmPresenter={iAmPresenter} voterTotal={voterTotal} />
        </div>
      )}

      {snap.phase === 'reveal' && <RevealBody snap={snap} isHost={isHost} room={room} />}

      {snap.phase === 'final' && <FinalBody snap={snap} isHost={isHost} room={room} />}

      <PlayerStrip snap={snap} meId={room.playerId} />
    </section>
  );
};

const LobbyBody = ({
  snap,
  isHost,
  connectedCount,
  room,
}: {
  snap: NonNullable<UseRoom['room']>;
  isHost: boolean;
  connectedCount: number;
  room: UseRoom;
}) => {
  const shareUrl = `${window.location.origin}/?room=${snap.code}`;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(shareUrl).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  return (
    <div className={styles.lobby}>
      <div className={styles.codeCard}>
        <span className={appStyles.eyebrow}>部屋コード</span>
        <p className={styles.codeBig}>{snap.code}</p>
        <div className={styles.shareRow}>
          <input className={styles.textInput} value={shareUrl} readOnly />
          <button className={appStyles.secondaryButton} type="button" onClick={copy}>
            {copied ? 'コピーしました' : 'リンクをコピー'}
          </button>
        </div>
        <p className={styles.help}>このコードかリンクを仲間に共有してください。各自のスマホから参加できます。</p>
      </div>

      {isHost ? (
        <button
          className={appStyles.leverButton}
          type="button"
          disabled={connectedCount < 2}
          onClick={() => room.send({ t: 'startRound' })}
        >
          {connectedCount < 2 ? 'あと1人以上の参加を待っています' : 'ゲームを始める'}
        </button>
      ) : (
        <p className={styles.waitNote}>司会がゲームを始めるのを待っています…</p>
      )}
    </div>
  );
};

const Hand = ({ snap }: { snap: NonNullable<UseRoom['room']> }) =>
  snap.hand ? (
    <div className={styles.handGrid}>
      {snap.hand.map((card) => (
        <div key={card.id} className={appStyles.card}>
          <span className={appStyles.cardKind}>{KIND_LABEL[card.kind]}</span>
          <strong>{card.text}</strong>
          <span className={appStyles.cardTone}>
            {card.tone === 'serious' ? '真面目' : 'ネタ'}・{GENRE_LABEL[card.genre]}
          </span>
        </div>
      ))}
    </div>
  ) : null;

const VotingBody = ({
  snap,
  room,
  iAmPresenter,
  voterTotal,
}: {
  snap: NonNullable<UseRoom['room']>;
  room: UseRoom;
  iAmPresenter: boolean;
  voterTotal: number;
}) => {
  const votedCount = snap.votedPlayerIds.length;
  const progress = `${votedCount} / ${voterTotal} 人が投票`;

  if (iAmPresenter) {
    return (
      <div className={styles.votePanel}>
        <p className={styles.bigLead}>あなたの発表を査読中…</p>
        <p className={styles.help}>{progress}</p>
      </div>
    );
  }
  if (snap.myVote) {
    return (
      <div className={styles.votePanel}>
        <p className={styles.bigLead}>投票しました ✓</p>
        <p className={styles.help}>他の人を待っています… （{progress}）</p>
      </div>
    );
  }
  return (
    <div className={styles.votePanel}>
      <p className={styles.bigLead}>この研究、査読を通しますか？</p>
      <div className={appStyles.voteButtons}>
        <button className={appStyles.acceptButton} type="button" onClick={() => room.vote('accept')}>
          Accept
        </button>
        <button className={appStyles.rejectButton} type="button" onClick={() => room.vote('reject')}>
          Reject
        </button>
      </div>
      <p className={styles.help}>{progress}・投票は同時に公開されます</p>
    </div>
  );
};

const RevealBody = ({
  snap,
  isHost,
  room,
}: {
  snap: NonNullable<UseRoom['room']>;
  isHost: boolean;
  room: UseRoom;
}) => {
  const rv = snap.reveal;
  if (!rv) return null;
  return (
    <div className={appStyles.tallyPanel}>
      <div className={appStyles.resultStampWrap}>
        <span className={`${appStyles.resultStamp} ${rv.accepted ? appStyles.acceptedStamp : appStyles.rejectedStamp}`}>
          {rv.accepted ? '採択' : '不採択'}
        </span>
        <p>
          Accept {rv.acceptCount} ／ Reject {rv.rejectCount}
          {rv.unanimous ? '（満場一致！）' : ''}
        </p>
      </div>

      <div className={appStyles.voteRevealList}>
        {rv.votes.map((v) => {
          const player = snap.players.find((p) => p.id === v.playerId);
          return (
            <p key={v.playerId} className={appStyles.voteReveal}>
              <span>{player?.name ?? '?'}</span>
              <strong>{v.vote === 'accept' ? 'Accept' : 'Reject'}</strong>
            </p>
          );
        })}
      </div>

      {isHost ? (
        <button className={appStyles.primaryButton} type="button" onClick={() => room.send({ t: 'nextRound' })}>
          次へ
        </button>
      ) : (
        <p className={styles.waitNote}>司会が次に進めるのを待っています…</p>
      )}
    </div>
  );
};

const FinalBody = ({
  snap,
  isHost,
  room,
}: {
  snap: NonNullable<UseRoom['room']>;
  isHost: boolean;
  room: UseRoom;
}) => {
  const ranked = [...snap.players].sort((a, b) => b.score - a.score);
  return (
    <div className={appStyles.tallyPanel}>
      <div className={appStyles.scoreTable} style={{ width: 'min(100%, 560px)' }}>
        {ranked.map((p, index) => (
          <div key={p.id} className={appStyles.scoreRow}>
            <span className={appStyles.rank}>{index + 1}</span>
            <span>{p.name}</span>
            <span>{p.score} 点</span>
          </div>
        ))}
      </div>
      {isHost && (
        <button className={appStyles.primaryButton} type="button" onClick={() => room.send({ t: 'restart' })}>
          もう一度あそぶ
        </button>
      )}
    </div>
  );
};

const PlayerStrip = ({ snap, meId }: { snap: NonNullable<UseRoom['room']>; meId: string | null }) => (
  <div className={styles.playerStrip}>
    {snap.players.map((p) => (
      <span key={p.id} className={`${styles.playerChip} ${p.connected ? '' : styles.offline}`}>
        {p.name}
        {p.isHost && <em className={styles.tag}>司会</em>}
        {snap.presenterId === p.id && <em className={styles.tag}>発表</em>}
        {snap.phase === 'voting' && snap.votedPlayerIds.includes(p.id) && <em className={styles.tagDone}>投票済</em>}
        {p.id === meId && <em className={styles.tagMe}>あなた</em>}
      </span>
    ))}
  </div>
);
