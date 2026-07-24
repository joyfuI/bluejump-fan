import { Badge, Button, Card, Flex, Modal } from 'antd';
import { Dices } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { DataType } from '@/components/MusicbookTable';

export type MusicbookRandomModalProps = {
  open: boolean;
  data: DataType[];
  onClose: () => void;
};

const MusicbookRandomModal = ({
  open,
  data,
  onClose,
}: MusicbookRandomModalProps) => {
  const [result, setResult] = useState<DataType>();

  const handleRandomClick = useCallback(() => {
    setResult(data[Math.floor(Math.random() * data.length)]);
  }, [data]);

  useEffect(() => {
    if (open) {
      handleRandomClick();
    }
  }, [open, handleRandomClick]);

  return (
    <Modal footer={null} onCancel={onClose} open={open}>
      <Flex align="center" gap="medium" vertical>
        <Badge.Ribbon text={result?.분류}>
          <Card
            className="w-96"
            styles={{
              header: { paddingTop: 24, paddingBottom: 24 },
              title: { whiteSpace: 'initial' },
            }}
            title={`${result?.가수 && result?.가수 !== '-' ? result?.가수 : '(정보없음)'} - ${result?.제목}`}
          >
            {result?.비고 || result?.단가 ? (
              <>
                <p>{result?.비고}</p>
                {result?.단가 ? <p>단가: {result?.단가}</p> : null}
              </>
            ) : null}
          </Card>
        </Badge.Ribbon>

        <Button
          icon={<Dices />}
          onClick={handleRandomClick}
          shape="round"
          size="large"
          type="primary"
        >
          다시 뽑기!
        </Button>
      </Flex>
    </Modal>
  );
};

export default MusicbookRandomModal;
