import React from 'react';

const SIZE_CLASSES = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs font-bold',
  lg: 'w-10 h-10 text-sm font-bold',
  xl: 'w-14 h-14 text-base font-bold'
};

export function MemberAvatar({ member, size = 'md', className = '' }) {
  if (!member) {
    return (
      <div className={`rounded-full bg-slate-300 flex items-center justify-center text-slate-600 ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${className}`}>
        ?
      </div>
    );
  }

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (member.avatarImage) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 border border-white/80 shadow-xs ${sizeClass} ${className}`}>
        <img
          src={member.avatarImage}
          alt={member.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white shrink-0 shadow-xs border border-white/80 ${sizeClass} ${className}`}
      style={{ backgroundColor: member.avatarColor || '#3B82F6' }}
    >
      {member.name ? member.name.charAt(0) : '?'}
    </div>
  );
}
