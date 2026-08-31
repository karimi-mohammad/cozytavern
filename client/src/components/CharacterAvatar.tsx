interface Props {
  name: string;
  avatar?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-lg',
};

export default function CharacterAvatar({ name, avatar, size = 'md' }: Props) {
  const initial = name?.[0] || '?';

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-tavern-accent/30 flex items-center justify-center text-tavern-accent font-bold flex-shrink-0`}>
      {initial}
    </div>
  );
}
