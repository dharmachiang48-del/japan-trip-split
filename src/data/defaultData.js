export const PRESET_AVATARS = [
  { id: 'levi', name: '里維兵長', image: '/avatars/levi.jpg' },
  { id: 'shiba', name: '萌柴犬', image: '/avatars/shiba.jpg' },
  { id: 'cat', name: '招財貓', image: '/avatars/cat.jpg' },
  { id: 'fuji', name: '富士山', image: '/avatars/fuji.jpg' },
];

export const DEFAULT_MEMBERS = [
  { id: 'mem_1', name: '小明', avatarColor: '#1E293B', avatarImage: '/avatars/levi.jpg' },
  { id: 'mem_2', name: '小華', avatarColor: '#EC4899', avatarImage: '/avatars/cat.jpg' },
  { id: 'mem_3', name: '美美', avatarColor: '#10B981', avatarImage: '/avatars/shiba.jpg' }
];

export const CATEGORIES = [
  { id: 'food', name: '美食餐飲', icon: 'Utensils', color: 'bg-amber-100 text-amber-700' },
  { id: 'traffic', name: '交通票券', icon: 'Train', color: 'bg-blue-100 text-blue-700' },
  { id: 'ticket', name: '景點門票', icon: 'Ticket', color: 'bg-purple-100 text-purple-700' },
  { id: 'shopping', name: '購物藥妝', icon: 'ShoppingBag', color: 'bg-rose-100 text-rose-700' },
  { id: 'hotel', name: '住宿飯店', icon: 'Hotel', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'other', name: '其他雜支', icon: 'MoreHorizontal', color: 'bg-slate-100 text-slate-700' }
];

export const INITIAL_EXPENSES = [
  {
    id: 'exp_1',
    title: '一蘭拉麵 (澀谷店)',
    amount: 3960,
    currency: 'JPY',
    rate: 0.215,
    payerId: 'mem_1',
    splitMemberIds: ['mem_1', 'mem_2', 'mem_3'],
    category: 'food',
    date: '2026-09-04',
    note: '包含加麵與溫泉蛋'
  },
  {
    id: 'exp_2',
    title: '東京晴空塔觀景台門票',
    amount: 2160,
    currency: 'TWD',
    rate: 1.0, // 直接台幣扣款免換算
    payerId: 'mem_2',
    splitMemberIds: ['mem_1', 'mem_2', 'mem_3'],
    category: 'ticket',
    date: '2026-09-03',
    note: 'Klook 刷卡台幣預訂'
  },
  {
    id: 'exp_3',
    title: '新幹線東京往京都車票',
    amount: 42000,
    currency: 'JPY',
    rate: 0.215,
    payerId: 'mem_3',
    splitMemberIds: ['mem_1', 'mem_2', 'mem_3'],
    category: 'traffic',
    date: '2026-09-05',
    note: '綠色車廂指定席'
  }
];
