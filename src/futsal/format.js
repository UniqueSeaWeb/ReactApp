// 表示用フォーマット

const timeFmt = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

export const formatTime = (iso) => timeFmt.format(new Date(iso))
// "YYYY-MM-DD" はタイムゾーン付きで解釈されると日付がずれるため、ローカル日時として読む
export const formatDate = (ymd) => dateFmt.format(new Date(`${ymd}T00:00:00`))

export const memberLabel = (m) => (m ? `${m.number != null ? `${m.number} ` : ''}${m.name}` : '（削除された選手）')
