import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('ko');
dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
