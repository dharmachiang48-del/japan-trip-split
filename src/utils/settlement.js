// 智慧分帳結算與債務簡化演算法 (Settlement & Debt Simplification)

import { convertToTwd, formatTWD } from './currency';

/**
 * 計算分帳明細與每人收支統計
 * @param {Array} members - 成員列表 [{ id, name, avatarColor }]
 * @param {Array} expenses - 支出列表 [{ id, title, amount, currency, rate, payerId, splitMemberIds, category, date }]
 * @returns {Object} { memberBalances, transfers, totalSpentTwd, totalSpentJpy }
 */
export function calculateSettlement(members, expenses) {
  // 1. 初始化每位成員的收支帳目
  const balances = {};
  members.forEach(m => {
    balances[m.id] = {
      member: m,
      paidTwd: 0,
      shareTwd: 0,
      netTwd: 0 // paid - share (>0 代表應收款，<0 代表應付款)
    };
  });

  let totalSpentTwd = 0;
  let totalSpentJpy = 0;

  // 2. 遍歷每筆支出，累積付款與分攤
  expenses.forEach(exp => {
    const amountTwd = convertToTwd(exp.amount, exp.currency, exp.rate);
    totalSpentTwd += amountTwd;
    if (exp.currency === 'JPY') {
      totalSpentJpy += exp.amount;
    }

    // 累加代墊者付款
    if (balances[exp.payerId]) {
      balances[exp.payerId].paidTwd += amountTwd;
    }

    // 判斷是否為自訂每人金額分攤 (如 A 負擔 50，B 負擔 60)
    if (exp.splitAmounts && Object.keys(exp.splitAmounts).length > 0) {
      Object.entries(exp.splitAmounts).forEach(([mId, customAmt]) => {
        const customAmtTwd = convertToTwd(Number(customAmt) || 0, exp.currency, exp.rate);
        if (balances[mId]) {
          balances[mId].shareTwd += customAmtTwd;
        }
      });
    } else {
      // 平均分攤模式
      const splitCount = exp.splitMemberIds && exp.splitMemberIds.length > 0
        ? exp.splitMemberIds.length
        : members.length;

      const splitIds = exp.splitMemberIds && exp.splitMemberIds.length > 0
        ? exp.splitMemberIds
        : members.map(m => m.id);

      const perPersonTwd = amountTwd / splitCount;

      splitIds.forEach(mId => {
        if (balances[mId]) {
          balances[mId].shareTwd += perPersonTwd;
        }
      });
    }
  });

  // 計算個人淨額 (四捨五入整數)
  Object.values(balances).forEach(b => {
    b.paidTwd = Math.round(b.paidTwd);
    b.shareTwd = Math.round(b.shareTwd);
    b.netTwd = b.paidTwd - b.shareTwd;
  });

  // 3. 最小化轉帳筆數演算法 (Greedy Debt Simplification)
  const debtors = [];   // 需要付錢的人 (net < 0)
  const creditors = []; // 需要收錢的人 (net > 0)

  Object.values(balances).forEach(b => {
    if (b.netTwd < -0.5) {
      debtors.push({ id: b.member.id, name: b.member.name, amount: Math.abs(b.netTwd) });
    } else if (b.netTwd > 0.5) {
      creditors.push({ id: b.member.id, name: b.member.name, amount: b.netTwd });
    }
  });

  // 排序：金額大的優先配對
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount >= 1) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: Math.round(settleAmount)
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.5) dIdx++;
    if (creditor.amount < 0.5) cIdx++;
  }

  return {
    memberBalances: Object.values(balances),
    transfers,
    totalSpentTwd,
    totalSpentJpy
  };
}

/**
 * 產生適合複製分享至 LINE / 通訊軟體的結算文字格式
 */
export function generateLineSettlementText(tripTitle, members, expenses) {
  const { memberBalances, transfers, totalSpentTwd } = calculateSettlement(members, expenses);
  const now = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });

  let text = `🗾【${tripTitle || '日本旅遊'}】分帳結算清單\n`;
  text += `📅 結算日期：${now}\n`;
  text += `💰 旅程總支出：${formatTWD(totalSpentTwd)}\n`;
  text += `👥 旅伴人數：${members.length} 人\n`;
  text += `---------------------------\n`;
  text += `📊【個人收支明細】\n`;

  memberBalances.forEach(b => {
    const status = b.netTwd > 0 
      ? `應收 ${formatTWD(b.netTwd)} 🟢` 
      : b.netTwd < 0 
        ? `應付 ${formatTWD(Math.abs(b.netTwd))} 🔴` 
        : `已結清 ⚪`;
    text += `• ${b.member.name}：代付 ${formatTWD(b.paidTwd)} / 應攤 ${formatTWD(b.shareTwd)} (${status})\n`;
  });

  text += `---------------------------\n`;
  text += `🤝【最佳結清轉帳路徑】（最少轉帳次數）：\n`;

  if (transfers.length === 0) {
    text += `🎉 帳目已全部平衡，無須轉帳！\n`;
  } else {
    transfers.forEach((t, i) => {
      text += `${i + 1}. 【${t.fromName}】 ➡️ 轉給 ➡️ 【${t.toName}】 ${formatTWD(t.amount)}\n`;
    });
  }

  text += `---------------------------\n`;
  text += `※ 支援 LINE Pay / 銀行網銀轉帳結清。旅途愉快！✨`;

  return text;
}
