import React from 'react';import {Tag} from 'antd';import {PRIORITY_COLORS} from '@tradeperfect/shared';
export default function PriorityTag({priority}){return priority?<Tag color={PRIORITY_COLORS[priority]||'default'}>{priority}</Tag>:<span>—</span>;}
