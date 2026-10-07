export interface LawyerEmojiMeta {
  emoji: string;
  title: string;
  gradient: string;
  border: string;
}

/** Returns the dedicated Indian legal emoji and executive badge styling for each specialist. */
export function getLawyerEmoji(name?: string, identity?: string): LawyerEmojiMeta {
  const n = (name ?? '').toLowerCase();

  if (n.includes('sanhita') || n.includes('criminal')) {
    return {
      emoji: '⚖️',
      title: 'Bharath Sanhita / Criminal Law Specialist',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      border: 'rgba(212, 175, 55, 0.75)',
    };
  }
  if (
    n.includes('civil') ||
    n.includes('constitutional') ||
    n.includes('litigator')
  ) {
    return {
      emoji: '🏛️',
      title: 'Bharath Civil & Constitutional Litigator',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f213d 100%)',
      border: 'rgba(147, 197, 253, 0.85)',
    };
  }
  if (n.includes('draft') || n.includes('pleading') || n.includes('writer')) {
    return {
      emoji: '📜',
      title: 'Bharath Legal Drafter',
      gradient: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
      border: 'rgba(253, 224, 71, 0.85)',
    };
  }
  if (
    n.includes('corporate') ||
    n.includes('ibc') ||
    n.includes('arbitration') ||
    n.includes('coder')
  ) {
    return {
      emoji: '💼',
      title: 'Bharath Corporate & IBC Specialist',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
      border: 'rgba(110, 231, 183, 0.85)',
    };
  }
  if (n.includes('judge') || n.includes('bench')) {
    return {
      emoji: '👨‍⚖️',
      title: 'Presiding Judge',
      gradient: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
      border: 'rgba(199, 210, 254, 0.85)',
    };
  }

  // Primary Bharath Law Chief Counsel / default
  if (n.includes('bharath') || n.includes('chambers') || n.includes('law')) {
    return {
      emoji: '👨‍⚖️',
      title: 'Bharath Law Senior Advocate',
      gradient: 'linear-gradient(135deg, #0f213d 0%, #173258 100%)',
      border: '#d4af37',
    };
  }

  // Custom agent rotation based on deterministic identity hash
  const fallbackEmojis: LawyerEmojiMeta[] = [
    {
      emoji: '⚖️',
      title: 'Legal Counsel',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      border: '#d4af37',
    },
    {
      emoji: '👨‍⚖️',
      title: 'Senior Advocate',
      gradient: 'linear-gradient(135deg, #0f213d 0%, #173258 100%)',
      border: '#d4af37',
    },
    {
      emoji: '🏛️',
      title: 'Constitutional Counsel',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f213d 100%)',
      border: '#93c5fd',
    },
    {
      emoji: '📜',
      title: 'Legal Drafter',
      gradient: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
      border: '#fde047',
    },
    {
      emoji: '💼',
      title: 'Corporate Counsel',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
      border: '#6ee7b7',
    },
    {
      emoji: '👩‍⚖️',
      title: 'Justice / Advocate',
      gradient: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)',
      border: '#e9d5ff',
    },
    {
      emoji: '📑',
      title: 'Case Researcher',
      gradient: 'linear-gradient(135deg, #164e63 0%, #083344 100%)',
      border: '#67e8f9',
    },
    {
      emoji: '🖋️',
      title: 'Legal Pleading Specialist',
      gradient: 'linear-gradient(135deg, #831843 0%, #500724 100%)',
      border: '#fbcfe8',
    },
  ];

  let hash = 0;
  const str = identity || name || 'default';
  for (const char of str) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return fallbackEmojis[hash % fallbackEmojis.length];
}

export function Mascot({
  state = 'idle',
  small = false,
  identity,
  name = 'Dot',
  decorative = false,
}: {
  state?: string;
  small?: boolean;
  identity?: string;
  name?: string;
  decorative?: boolean;
}) {
  const meta = getLawyerEmoji(name, identity);

  return (
    <span
      className={`mascot lawyer-avatar-badge ${state} ${small ? 'small' : ''}`}
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : `${name} (${meta.title})`}
      style={{
        background: meta.gradient,
        borderColor: meta.border,
      }}
    >
      <span className="lawyer-avatar-emoji" aria-hidden="true">
        {meta.emoji}
      </span>
    </span>
  );
}
