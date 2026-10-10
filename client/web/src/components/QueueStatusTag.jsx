import React from 'react';import {Tag} from 'antd';import {QUEUE_STATUS_COLORS} from '@tradeperfect/shared';
export default function QueueStatusTag({status}){return status?<Tag color={QUEUE_STATUS_COLORS[status]||'default'}>{status}</Tag>:<span>—</span>;}
