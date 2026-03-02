/**
 * 클립보드에 텍스트를 복사하는 함수
 * @param text 복사할 텍스트
 */
const copyText = (text: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    document.execCommand('copy');
    textArea.setSelectionRange(0, 0);
    document.body.removeChild(textArea);
  }
};

export default copyText;
