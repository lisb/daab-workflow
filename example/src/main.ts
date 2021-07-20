// Copyright (c) 2021 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { Robot } from 'lisb-hubot';

export = (robot: Robot) => {
  robot.respond(/hello$/i, (res) => {
    res.send(`hello, ${res.message.user.name}`);
  });
};

// import { workflow } from 'daab-workflow';
// export = workflow('./workflows');
