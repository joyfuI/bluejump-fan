import type { CheckboxOptionType } from 'antd';
import { Checkbox, Drawer, FloatButton } from 'antd';
import { ListFilter } from 'lucide-react';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import { useId, useState } from 'react';

import { MEMBERS } from '@/data/constants';

const FilterButton = () => {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useQueryState(
    'userId',
    parseAsArrayOf(parseAsString).withDefault(
      MEMBERS.map((member) => member.id),
    ),
  );
  const checkboxName = useId();

  const options: CheckboxOptionType<string>[] = MEMBERS.map((member) => ({
    label: member.nick,
    value: member.id,
  }));

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Drawer onClose={handleClose} open={open} title="필터">
        <Checkbox.Group
          className="flex-col gap-2"
          name={checkboxName}
          onChange={setUserId}
          options={options}
          value={userId}
        />
      </Drawer>
      <FloatButton
        icon={<ListFilter />}
        onClick={() => setOpen(true)}
        tooltip="필터"
      />
    </>
  );
};

export default FilterButton;
