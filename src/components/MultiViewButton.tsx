import { Alert, Badge, Button, Flex, FloatButton, Image, Modal } from 'antd';
import { useState } from 'react';

import type { GetHomeBroadResponse } from '@/api/getHomeBroad';
import type { GetStationInfoResponse } from '@/api/getStationInfo';

export type MultiViewButtonProps = {
  data: (Partial<GetStationInfoResponse> & {
    broad: GetHomeBroadResponse | null;
  })[];
};

const MultiViewButton = ({ data }: MultiViewButtonProps) => {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState<string[]>([]);

  const handleClick = (userId: string) => {
    let newCheck = [...check];
    if (check.includes(userId)) {
      newCheck = newCheck.filter((item) => item !== userId);
    } else {
      newCheck.push(userId);
    }
    setCheck(newCheck);
  };

  const handleOk = () => {
    window.open(`https://mul.live/${check.join('/')}`, '_blank');
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <>
      <Modal
        onCancel={handleCancel}
        onOk={handleOk}
        open={open}
        title="멀티뷰 (외부 서비스 이용)"
      >
        <Alert
          className="mb-4"
          title={
            <>
              Mul.Live 서비스를 이용합니다.
              <br />
              <a
                href={
                  navigator.userAgent.includes('Firefox')
                    ? 'https://addons.mozilla.org/ko/firefox/addon/mullive/'
                    : 'https://chromewebstore.google.com/detail/mullive-plus/pahcphmhihleneomklgfbbneokhjiaim'
                }
                rel="noreferrer"
                target="_blank"
              >
                Mul.Live Plus 확장프로그램
              </a>
              을 설치하면 채팅 등 로그인 기능을 사용할 수 있습니다.
              <br />숲 동시시청 제한은 최대 4개입니다.
            </>
          }
          type="info"
        />
        <Flex gap="small" vertical>
          {data.map((item, index) => {
            return (
              <Button
                block
                icon={
                  <Badge
                    color="blue"
                    count={check.indexOf(item.station?.userId ?? '') + 1}
                    title=""
                  />
                }
                key={item.station?.userId ?? index}
                onClick={() => handleClick(item.station?.userId ?? '')}
                size="large"
                type={
                  check.includes(item.station?.userId ?? '')
                    ? 'primary'
                    : 'default'
                }
              >
                {item.station?.userNick}
                {item.broad?.broadNo ? <Badge count="LIVE" title="" /> : null}
              </Button>
            );
          })}
        </Flex>
      </Modal>
      <FloatButton
        icon={
          <Image
            alt="Mul.Live"
            height={20}
            preview={false}
            src="/mul-live.svg"
            width={20}
          />
        }
        onClick={() => setOpen(true)}
        tooltip="멀티뷰"
      />
    </>
  );
};

export default MultiViewButton;
