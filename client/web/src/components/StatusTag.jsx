import React from 'react';import {Tag} from 'antd';import {STATUS_COLORS} from '@tradeperfect/shared';
export default function StatusTag({status}){return status?<Tag color={STATUS_COLORS[status]||'default'}>{status}</Tag>:<span>—</span>;}
