import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  target: 100,
  duration: "3m",
};

export default function () {
  const payload = {
    init_data:
      "user=%7B%22id%22%3A38071982%2C%22first_name%22%3A%22Amir%22%2C%22last_name%22%3A%22Sepehri%22%2C%22username%22%3A%22Amir_MLTV%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2Fyri5s8WHK6TgqPrSuQhvksEGEWW0IXzUpYeE3DWsneU.svg%22%7D&chat_instance=-4294228547133164376&chat_type=private&start_param=ref1104870100&auth_date=1731522327&hash=7b1f9d6d5b5acd242511021703a36e97572ace4a8d9b69f7d19383d9c19702e8",
    map_info: {
      planet_id: 1,
      x_loc_min: 1,
      x_loc_max: 10,
      y_loc_min: 1,
      y_loc_max: 10,
    },
  };

  const headers = {
    "Content-Type": "application/json",
  };

  const res = http.post(
    "https://api.ticktom.com/api/map_range/",
    JSON.stringify(payload),
    {
      headers,
    }
  );

  check(res, { "status was 200": (r) => r.status == 200 });

  sleep(1);
}
